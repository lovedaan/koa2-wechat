const Koa = require('koa');
const path = require('path');
const KoaBody = require('koa-body');
const KoaStatic = require('koa-static');
const KoaRouter = require('koa-router');
const sha1 = require('sha1');
const rp = require('request-promise');
const sign = require('./libs/sign.js');

const app = new Koa();
const router = new KoaRouter();
const config = {
  appID: 'wx95649533b1735692',
  appsecret: '9b33023b6ef11424e562d828b6ad5bcb',
  token: 'nodewechat'
};

app.use(KoaStatic('./www/'));
app.use(KoaStatic('./uploads/'));
app.use(KoaBody({
  multipart: true,
  formidable: {
    keepExtensions: true,
    uploadDir: path.resolve(__dirname, './uploads/')
  }
}));
// 获取全局token，数据请求回来，缓存，7200s后再请求
const getGlobalAccessToken = () => {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.appID}&secret=${config.appsecret}`;
  let startTime = 0;
  let data = null;
  return async function () {
    let nowTime = Date.now();
    if(startTime && nowTime - startTime >= 7200 * 1000) {
      startTime = Date.now();
      data = await rp({
        url,
        json: true
      });
      return data;
    }else {
      if(!startTime) {
        startTime = Date.now();
        data = await rp({
          url,
          json: true
        });
        return data;
      }else {
        return new Promise((resolve) => {resolve(data)});
      }
    }
  }
}

// 获取jsapi_ticket，数据请求回来，缓存，7200s后再请求
const getJsapiTicket = (access_token) => {
  const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${access_token}&type=jsapi`;
  let startTime = 0;
  let data = null;
  return async function () {
    let nowTime = Date.now();
    if(startTime && nowTime - startTime >= 7200 * 1000) {
      startTime = Date.now();
      data = await rp({
        url,
        json: true
      });
      return data;
    }else {
      if(!startTime) {
        startTime = Date.now();
        data = await rp({
          url,
          json: true
        });
        return data;
      }else {
        return new Promise((resolve) => {resolve(data)});
      }
    }
  }
}

// 获取网页授权token
const getOauthToken = async (code) => {
  const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.appID}&secret=${config.appsecret}&code=${code}&grant_type=authorization_code`;
  return rp({
        url,
        json: true
      });
}

// 获取用户信息
const getWechatUserInfo = async (token, openid, lang = 'zh_CN') => {
  const url = `https://api.weixin.qq.com/sns/userinfo?access_token=${token}&openid=${openid}&lang=${lang}`;
  return rp({
        url,
        json: true
      });
}

// 获取豆瓣电影
const getDoubanMovie = async(type, start = 0, count = 10) => {
  const uri = 'http://api.douban.com/v2/movie/' + type;
  const options = {
    uri,
    qs: {
      apikey: '0b2bdeda43b5688921839c8ecb20399b',
      start,
      count
    },
    json: true
  };
  return await rp(options);
}
// 获取豆瓣详情
// http://api.douban.com/v2/movie/subject/1292052?apikey=0b2bdeda43b5688921839c8ecb20399b
const getDoubanMovieDetai = async(id) => {
  const uri = 'http://api.douban.com/v2/movie/subject/' + id;
  const options = {
    uri,
    qs: {
      apikey: '0b2bdeda43b5688921839c8ecb20399b'
    },
    json: true
  };
  return await rp(options);
}

// 验证微信服务器
router.get('/wechat-apply', async ctx => {
  const {signature, timestamp, nonce, echostr} = ctx.query;
  let tmpArr = [config.token, timestamp, nonce].sort();
  let tmpStr = tmpArr.join('');
  tmpStr = sha1(tmpStr);
  if(tmpStr === signature) {
    ctx.body = echostr;
  }else {
    ctx.body = {
      code: -99,
      msg: '验证微信服务器失败'
    }
  }
});

// {"access_token":"26_ErHQ_xH3OuyTz7QtVugsd3rjj25n0fIre70TT1zZygXmxjG1X-YIB94SCAdP9ctEhPzak8TJtyjvnsEqIsVrsYwdnAuNachl0aqtNL7UwMhXHDHK4Z7mCCrfbvAAEC7FmZ9mxOS4z5FgGxDwDYGbAAAKFN","expires_in":7200}

router.get('/getTicket', async ctx => {
  const getToken = getGlobalAccessToken();
  let {access_token} = await getToken();
  const getTicket = getJsapiTicket(access_token);
  let data = await getTicket();
  ctx.body = data;
});

// http://17072yh945.iok.la/wechat-oauth?url=http%3A%2F%2F17072yh945.iok.la%2Findex.html%23%2Fin_theaters
router.get('/wechat-oauth', async ctx => {
  const uri = ctx.query.url || 'http://17072yh945.iok.la/index.html#/in_theaters';
  const url = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + config.appID + '&redirect_uri='+ encodeURIComponent(uri) +'&response_type=code&scope=snsapi_userinfo#wechat_redirect';
  ctx.redirect(url);
});


router.get('/wechat-userInfo', async ctx => {
  const { code } = ctx.query;
  // 通过code获取网页授权token
  const oauthInfo = await getOauthToken(code);
  // 通过access_token，openid拉取用户信息
  const wechatUserInfo = await getWechatUserInfo(oauthInfo.access_token, oauthInfo.openid);

  ctx.body = wechatUserInfo
});

router.get('/wechat-jssdk', async ctx => {
  const { url } = ctx.query;
  // 获取全局token
  const getToken = getGlobalAccessToken();
  let {access_token} = await getToken();
  // 通过access_token，获取jsapi_ticket
  const getTicket = getJsapiTicket(access_token);
  let {ticket} = await getTicket();
  let signOpt = sign(ticket, decodeURIComponent(url));
  ctx.body = {
    code: 0,
    msg: '签名获取成功',
    data: {
      ...signOpt,
      appId: config.appID
    }
  }
});

// http://17072yh945.iok.la/movie?type=in_theaters
// coming_soon
// top250
// http://api.douban.com/v2/movie/in_theaters?apikey=0b2bdeda43b5688921839c8ecb20399b
router.get('/movie', async ctx => {
  const type = ctx.query.type || 'in_theaters';
  const count = ctx.query.count || 10;
  const page = ctx.query.page || 1;
  const start = (page - 1) * count;
  const movieData = await getDoubanMovie(type, start, count);
  ctx.body = {
    code: 0,
    msg: '请求数据成功',
    data: movieData
  };
});
// http://17072yh945.iok.la/detail?id=1292052
router.get('/detail', async ctx => {
  const id = ctx.query.id;

  if(!id) {
    ctx.body = {
      code: -99,
      msg: 'ID不能为空',
      data: {}
    };
    return;
  }

  const movieData = await getDoubanMovieDetai(id);
  ctx.body = {
    code: 0,
    msg: '请求数据成功',
    data: movieData
  };
});


// test api =======================

router.get('/api/test/list', async ctx => {
  const {name,  age} = ctx.query;
  ctx.body = {
    code: 0,
    msg: '请求成功',
    data: {
      list: [{name, age}]
    }
  };
});

router.post('/api/test/login', async ctx => {
  const {name,  age} = ctx.request.body;
  ctx.body = {
    code: 0,
    msg: '请求成功',
    data: {
      list: [{name, age}]
    }
  };
});

router.post('/api/test/upload', async ctx => {
  console.log(ctx.request.files);
  const files = ctx.request.files.fileName;
  console.log(files)
  const pathObj = path.parse(files.path)
  console.log(pathObj)
  const {name,  age} = ctx.request.body;
  ctx.body = {
    errno: 0,
    msg: '请求成功',
    data: ['http://127.0.0.1:9000/' + pathObj.base]
  };
});


// end =============================

app.use(router.routes());


app.listen(9000, () => {
  console.log('listen 9000');
})