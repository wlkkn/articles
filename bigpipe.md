# BigPipe

这里主要介绍一下在express中实现bigpipe，对于bigpipe不太了解的，可以先去了解[bigpipe](http://baike.baidu.com/view/4601904.htm?fr=aladdin)。

![demo](https://raw.githubusercontent.com/vicanso/articles/master/pics/bigpipe.gif)


## 应用场景

在WEB开发中，我们都会遇到这样的情况，某个页面需要从数据库中获取几个结果，其中有一些是特别的慢，如果按照平时的开发模式，我们会等待所有的数据返回之后，render html再输出到浏览器。

## 示例

下面先来看一下如下代码：


```js

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
```

如上面所示，我们呈现一个页面，需要获取到以上三个数据才可以，而这三个数据中，getBookList是最慢的，需要3秒的时候，这里我使用了async.parallel，代码如下：

```js
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
```

对于jade页面，我这里就不写出来，大家可以参考源码。上面的代码可以看出，当开始render页面时并发送数据给浏览器，使用了3秒以上在时候，就是说用户在3秒之后才看到页面的内容开始显示（不考虑网络传输），在此过程之前是空白的页面。

```
    GET / 200 3077.154 ms - 756
```


我们现在再重新思考一下平时写的WEB页面，每个WEB页面总有一部分不需要与数据库打交道，我们是否应该先显示这部分的内容给用户看呢？或者就算是上面的例子，我们是否应该先显示新闻列表，再显示文章列表（出错信息），最后再把书籍列表显示出来呢？下面我们来看一下bigpipe的实现：

```js
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
```

上面将数据分成了两块main和partial，main主要是用于生成整个html的框架，partial对应的是各部分的页面，bigPipe的render方法如下：

```js
    var async = require('async');
    var _ = require('underscore');
    exports.render = function(req, res, options){
      var finished = false;
      var main = options.main;
      res.render(main.view, main.data, function(err, html){
        if(err){
          finished = true;
          res.send(err);
        }else{
          //生成非闭合的html
          html = html.replace('</html>', '');
          res.write(html);
        }
      });

      //生成script，将html插入到对应的id中
      var appendToHTML = function(id, html){
        res.write('<script>' +
          'document.getElementById("' + id + '").innerHTML= "' + html + '";' +
        '</script>');
      };

      // render部分的html
      var renderPartical = function(renderOptions, cbf){
        res.render(renderOptions.view, renderOptions.data, function(err, html){
          if(err){
            //如果出错，显示生成模板失败
            console.error(err);
            html = '生成模板失败！'
          }
          appendToHTML(renderOptions.id, html);
          cbf(null);
        });
      };
      var partial = options.partial;
      var fnList = _.map(partial, function(config, id){
        return function(cbf){
          var renderOptions = {
            id : id,
            view : config.view
          };
          var fn = config.data;
          // 判断获取数据的是否function，如果为function则表示数据为异步回调
          if(_.isFunction(fn)){
            fn(function(err, data){
              if(err){
                console.error(err);
                // 如果获取数据出错，显示出错信息
                appendToHTML(id, '获取数据失败');
                cbf(null);
              }else{
                renderOptions.data = data;
                renderPartical(renderOptions, cbf);
              }
            });
          }else{
            renderOptions.data = config.data;
            renderPartical(renderOptions, cbf);
          }
        };
      });
      async.parallel(fnList, function(err){
        if(!finished){
          res.end('</html>');
        }
      });
    }
```



```
    GET /bigpipe 200 3027.767 ms - -
```  

可以看出，使用bigpipe的方式和普通的方式最终使用的时间差不多（在不考虑网络延时之类），但是在现实中，由于bigpipe的方式是分段的将数据发送到浏览器，主体框架优化（用户很快就可以看到主体的数据以及浏览器可以尽早的加载css），接着新闻、文章和书籍慢慢的呈现。

bigpipe是很好的实现方式，但是在开发中不要为技术而技术。其实我们开发网页，有很多的页面是可以做缓存的，我更倾向于可以缓存的页面使用普通的方式来实现，将render的html缓存在varnish之类，而对应实时性很高，无法缓存的页面（用户相关的），使用bigpipe等。