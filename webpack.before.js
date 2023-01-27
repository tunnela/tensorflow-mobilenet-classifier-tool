var webpack = require('webpack');
var path = require('path');
var BuildMessagePlugin = require('@practo/build-message-webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var writeFile = require('write');
var loadJsonFile = require('load-json-file');
var package = loadJsonFile.sync('./package.json');
var WebpackOnBuildPlugin = require('on-build-webpack');
var internalIp = require('internal-ip');
var fs = require('fs');
var ChromeLauncher = require('chrome-launcher');
var esm = require('esm')(module);
var { Cert } = esm('selfsigned-ca');

var generateCerts = function (domain, rootPath) {
  rootPath =
    typeof rootPath === 'undefined' ? '../selfsigned-root-ca' : rootPath;

  var rootCaCert = new Cert(rootPath);
  // The certificate generated for use in the HTTP server. It is signed by the CA certificate.
  // That way you can create any amount of certificates and they will be all trusted as long
  // as the Root CA certificate is trusted (installed to device's keychain).
  // argument(s) point to .crt and .key file domains - ./selfsigned.localhost.crt & ./selfsigned.localhost.key
  var serverCert = new Cert('./certs/' + domain);

  var loadRootCertificate = function () {
    return rootCaCert.load().catch(function () {
      return rootCaCert.install();
    });
  };

  var createServerCertificate = function () {
    var serverCertOptions = {
      keySize: 2048,
      subject: {
        commonName: domain,
      },
      extensions: [
        {
          name: 'subjectAltName',
          altNames: [
            {
              type: 2,
              value: domain,
            },
          ],
        },
      ],
    };

    serverCert.create(serverCertOptions, rootCaCert);

    return serverCert.save();
  };

  var createRootCertificate = function () {
    // Couldn't load existing root CA certificate. Generate new one.
    rootCaCert.createRootCa({
      keySize: 2048,
      subject: {
        commonName: 'Punchzee App Root Certificate',
      },
    });

    return rootCaCert.save().then(function () {
      // Install the newly created CA to device's keychain so that all server certificates
      // signed by the CA are automatically trusted and green.
      return rootCaCert.install();
    });
  };

  var createCertificate = function () {
    return loadRootCertificate()
      .then(function () {
        return createServerCertificate();
      })
      .catch(function () {
        return createRootCertificate().then(function () {
          return createServerCertificate();
        });
      });
  };

  return serverCert.load().catch(createCertificate);
};

var excludeNodeModulesExcept = function(modules, extras) {
    var pathSep = path.sep;

    extras = extras || [];

    if (pathSep == '\\') {
        pathSep = '\\\\'; // must be quoted for use in a regexp:
    }
    var moduleRegExps = modules.map(function(modName) { 
        return new RegExp('node_modules' + pathSep + modName.replace('/', pathSep));
    });

    return function(modulePath) {
        for (var i = 0; i < extras.length; i++) {
            if (new RegExp(extras[i]).test(modulePath)) {
                return true;
            }
        }
        if (/node_modules/.test(modulePath)) {
            for (var i = 0; i < moduleRegExps.length; i++) {
                if (moduleRegExps[i].test(modulePath)) {
                    return false;
                }
            }
            return true;
        }
        return false;
    };
};

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
function mergeDeep(target) {
    var sources = [].slice.call(arguments);
    sources.shift();

    if (!sources.length) {
        return target;
    }

    var source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (Array.isArray(source[key])) {
                target[key] = source[key].slice(0);
            } else if (isObject(source[key])) {
                if (!target[key]) {
                    Object.assign(target, { [key]: {} });
                }
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    sources.unshift(target);

    return mergeDeep.apply(this, sources);
}

var data = {
    webpack: webpack,
    path: path,
    BuildMessagePlugin: BuildMessagePlugin,
    HtmlWebpackPlugin: HtmlWebpackPlugin,
    internalIp: internalIp,
    address: internalIp.v4.sync(),
    writeFile: writeFile,
    loadJsonFile: loadJsonFile,
    package: package,
    WebpackOnBuildPlugin: WebpackOnBuildPlugin,
    ChromeLauncher: ChromeLauncher,
    fs: fs,
    mergeDeep: mergeDeep,
    excludeNodeModulesExcept: excludeNodeModulesExcept,
    generateCerts: generateCerts
};

var prefix = (package.name + '.' + data.address).replace(/\./g, '-');

data.host = prefix + '.nip.io:8080';

module.exports = data;