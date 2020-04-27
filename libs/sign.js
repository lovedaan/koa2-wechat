const sha1 = require('sha1');
//生成签名
function createNonce() {
    return Math.random().toString(36).substr(2, 15);
}

function createTimestamp() {
    return parseInt(new Date().getTime() / 1000) + '';
}

function raw(args) {
    var keys = Object.keys(args);
    keys = keys.sort()
    var newArgs = {};
    keys.forEach(function(key) {
        newArgs[key.toLowerCase()] = args[key];
    });

    var string = '';
    for (var k in newArgs) {
        string += '&' + k + '=' + newArgs[k];
    }
    string = string.substr(1);
    return string;
}

function signIt(nonce, ticket, timestamp, url) {
    const ret = {
        jsapi_ticket: ticket,
        nonceStr: nonce,
        timestamp: timestamp,
        url: url
    };
    const string = raw(ret);
    const sha = sha1(string);

    return sha;
}

function sign(ticket, url) {
    const nonce = createNonce();
    const timestamp = createTimestamp();
    const signature = signIt(nonce, ticket, timestamp, url);

    return {
        noncestr: nonce,
        timestamp: timestamp,
        signature: signature
    }
}

module.exports = sign;