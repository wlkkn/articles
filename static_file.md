# 静态文件的处理

记得刚开始用express的时候，对于所有的middleware都只是用app.use(middleware)，并没有了解过有处理的逻辑，也没去考虑性能之类。先看下面的代码：

```js

    var express = require('express');
    var path = require('path');
    var app = express();
    var morgan = require('morgan');

    app.use(morgan('dev'));
    app.use(express.static(__dirname + '/public'));

    app.get('/', function(req, res){
      res.send('index');
    });

    app.listen(8000);
    console.log('server listen on 8000');

```

上面的代码只是简单将public整个目录做为静态文件目录，下面我们来做些压力测试：

```

    ab -n 5000 -c 100 http://192.168.1.8:8000/
    Requests per second:    1260.50 [#/sec] (mean)
    Time per request:       79.333 [ms] (mean)
    Time per request:       0.793 [ms] (mean, across all concurrent requests)
    Transfer rate:          226.50 [Kbytes/sec] received


    ab -n 5000 -c 100 http://192.168.1.8:8000/css/normalize.css
    Requests per second:    164.34 [#/sec] (mean)
    Time per request:       608.490 [ms] (mean)
    Time per request:       6.085 [ms] (mean, across all concurrent requests)
    Transfer rate:          1299.28 [Kbytes/sec] received
```

下面我们来调整一下代码，将静态文件的处理都添加mountPath，之后再重新做一次压力测试：

```js
    // app.use(express.static(__dirname + '/public'));
    app.use('/static', express.static(__dirname + '/public'));
```

```
    ab -n 5000 -c 100 http://192.168.1.8:8000/
    Requests per second:    1509.07 [#/sec] (mean)
    Time per request:       66.266 [ms] (mean)
    Time per request:       0.663 [ms] (mean, across all concurrent requests)
    Transfer rate:          271.22 [Kbytes/sec] received

    ab -n 5000 -c 100 http://192.168.1.8:8000/static/css/normalize.css
    Requests per second:    169.60 [#/sec] (mean)
    Time per request:       589.626 [ms] (mean)
    Time per request:       5.896 [ms] (mean, across all concurrent requests)
    Transfer rate:          1341.62 [Kbytes/sec] received
```

由上面的测试可以看出，当静态文件添加了mountPath的时候，express中很容易的判断出该请求是否需要进入express.static这个middleware，对性能有所提升（在测试的时候，有可能由于机器的原因导致这个测试并不非常明显）。

对express.static添加mountPath，对我而言，主要并不是有性能的提升（要提升静态文件的处理能力，更应该使用的是varnish之类的将http请求缓存），主要是做error的处理。下面考虑这样一种情景，假如express.static没有mountPath，当请求/css/test.css时，发现没有该文件，会继续到router部分，最后会去到404的处理（特别某些设计会使用特定的404页面），这个时候请求test.css就返回了一堆无用的数据，因此代码调整为如下：

```js
    var staticHandler = express.static(__dirname + '/public');
    app.use('/static', function(req, res){
      staticHandler(req, res, function(err){
        res.status(404).send('');
      });
    });
```


在使用express的middleware时，注意不在随意的app.use(middleware)，在实际开发中，我看过太多直接使用app.use(session({secret: 'keyboard cat'}))，这是很偷懒的做法，是否对于所有的请求，我们都是需要获取session呢？？更有甚者，session的middleware是放在static之前，难道请求静态文件都需要获取session？？express的middleware写的例子都太简单，希望大家使用的时候，要自己先了解一下，不要能用就好。