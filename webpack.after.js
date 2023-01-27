var BuildMessagePlugin = require('@practo/build-message-webpack');
var config = require('./build/config.json');
var startMessage = config.build.toUpperCase() + ' BUILD';

module.exports = {
    startMessage: new BuildMessagePlugin({
        message: "\n" + ('#'.repeat(startMessage.length + 8)) + "\n" +
        "#   " + (' '.repeat(startMessage.length)) + "   #\n" +
        "#   " + startMessage + "   #\n" + 
        "#   " + (' '.repeat(startMessage.length)) + "   #\n" +
        ('#'.repeat(startMessage.length + 8)) + "\n"
    })
};