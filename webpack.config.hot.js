var _ = require("./webpack.before.js");

module.exports = function (env) {
  var ssl = false; //env && !!env.ssl;
  var noBrowser = env && typeof env.noBrowser !== "undefined";
  var protocol = ssl ? "https" : "http";
  var wsProtocol = ssl ? "wss" : "ws";
  var port = ssl ? "44300" : "8000";
  var apiHost = ssl ? _.apiHostSSL : _.apiHost;
  var browser = false;
  var devPort = _.host.replace(/^.+:([0-9]+)$/, "$1");
  var devHost = _.host.replace(/:[0-9]+$/, "");

  var build = {
    build: "hot",
    env: process.env.NODE_ENV,
    ip: _.address,
    hot: true,
    staging: false,
    domain: protocol + "://" + _.host + "/",
    version: _.package.version,
  };

  _.writeFile.sync("build/config.json", JSON.stringify(build), function () {
    console.log(arguments);
  });

  var after = require("./webpack.after.js");

  var config = {
    devServer: {
      https: ssl,
      host: devHost,
      contentBase: "src/",
      hot: true,
      publicPath: build.domain,
      historyApiFallback: {
        index: "/",
      },
    },
    context: _.path.resolve(__dirname, "src/"),
    entry: {
      main: "./main.js",
    },
    output: {
      filename: "[name].min.js",
      path: _.path.resolve(__dirname, "src/"),
      publicPath: build.domain,
    },
    plugins: [
      after.startMessage,
      new _.webpack.HotModuleReplacementPlugin(),
      new _.HtmlWebpackPlugin({
        filename: "index.html",
        template: "index.ejs",
        env: build.env,
        hot: build.hot,
        staging: build.staging,
        assetPath: build.domain,
        build: build.build,
        version: build.version,
      }),
      new _.WebpackOnBuildPlugin(function (stats) {
        if (browser || noBrowser) {
          return;
        }
        browser = true;

        _.ChromeLauncher.launch({
          startingUrl: protocol + "://" + _.host,
          chromeFlags: ["--auto-open-devtools-for-tabs"],
        });
      }),
    ],
    resolve: {
      alias: {
        src: _.path.resolve(__dirname, "src/"),
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: [/node_modules/],
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
              plugins: [
                "@babel/plugin-transform-template-literals",
                "@babel/plugin-transform-runtime",
                "@babel/plugin-syntax-dynamic-import",
              ],
            },
          },
        },
      ],
    },
  };

  if (!ssl) {
    return config;
  }
  return _.generateCerts(devHost).then(function () {
    config.devServer.key = _.fs.readFileSync(
      "./certs/" + devHost + ".key",
      "utf8"
    );
    config.devServer.cert = _.fs.readFileSync(
      "./certs/" + devHost + ".crt",
      "utf8"
    );

    return config;
  });
};
