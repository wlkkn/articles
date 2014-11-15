var express = require('express');
var path = require('path');
var app = express();
var async = require('async');
var morgan = require('morgan');
var bigPipe = require('./helpers/bigpipe');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(morgan('dev'));

// 获取新闻列表，需要1秒后才返回数据
var getNewsList = function(cbf){
  setTimeout(function(){
    cbf(null, {
      newsList : [
        '今天即将下雨',
        '快要上课了',
        '天气还不错'
      ]
    });
  }, 1000);
};

// 获取文章列表，在2秒后返回了出错信息
var getArticleList = function(cbf){
  setTimeout(function(){
    cbf(new Error('get data fail'));
  }, 2000);
};


// 获取书列表，在3秒后返回数据
var getBookList = function(cbf){
  setTimeout(function(){
    cbf(null, {
      bookList : [
        '代码大全2',
        'mongodb',
        'varnish'
      ]
    });
  }, 3000);
};


app.get('/', function(req, res, next){
  async.parallel({
    articleList : function(cbf){
      //由于getArticleList返回异常，为了能显示，获取做特别处理
      getArticleList(function(err, data){
        cbf(null, []);
      });
    },
    bookList : getBookList,
    newsList : getNewsList
  }, function(err, data){
    if(err){
      console.error(err);
      return;
    }else{
      res.render('index', data);
    }
  })
});

app.get('/bigpipe', function(req, res, next){
  var newsList = {
    //对应的jade
    view : 'news',
    // 数据源，可以为Object或者function(回调)
    data : getNewsList
  };
  var articleList = {
    view : 'article',
    data : getArticleList
  };
  var bookList = {
    view : 'book',
    data : getBookList
  };
  bigPipe.render(req, res, {
    //不需要与数据库获取数据，用于render整个html的大框架
    main : {
      view : 'bigpipe',
      // 不支持异步获取数据
      data : {}
    },
    partial : {
      //id : data， object中的key对应html中的id
      newsList : newsList,
      articleList : articleList,
      bookList : bookList
    }
  });
});




app.listen(8000);
console.log('server listen on 8000');