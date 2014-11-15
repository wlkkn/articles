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