var fs = require('fs');
var path = require('path');
var rl = require('readline');
var mysql = require('mysql');
var async = require('async');

var dbCfg = {
    "host": "192.168.1.1",
    "port": "3306",
    "user": "xxx",
    "password": "xxx",
    "database": "log_md",
    "connectionLimit": 40,
    "debug": 0,
    "debugInterval": 30000//
}
var conn = mysql.createPool(dbCfg)
//启动一个定时任务 隔一段时间 抽取info中的内容 插入到数据库一次
var prefix = "__md__";

var basePath = __dirname;
function load() {
    var p = "./files";
    if (!fs.existsSync(p)) {
        throw new Error('path not exist, path:' + p);
    }
    p = fs.realpathSync(p);
    var files = [];
    fs.readdirSync(p).forEach(function (filename) {
        if (!/\.log$/.test(filename)) {
            return;
        }
        var name = path.basename(filename, '.js');
        files.push(basePath + "/files/" + name);
    });
    return files;
}
var tmp = load();
if (tmp.length > 0) {
    console.log('files===', tmp);
    var infos = [];//需要插入数据库的元素
    for (var m = 0; m < tmp.length; m++) {
        // var fd = fs.openSync(tmp[m],'r');
        var frs = fs.createReadStream(tmp[m], {
            flags: 'r',
            encoding: 'utf-8',
            autoClose:true
        });
        var r = rl.createInterface({
            input: frs//,
            // output: process.stdout
        });
        r.on('line', (line) => {
            analyzeData(line);
            // console.log(infos)
        });
        r.on('close', () => {
            console.error('=======读取结束======')
            insert(infos,conn);
        });
    }
}


/**
 * 分析每行的数据
 * @param {*} line 
 */
function analyzeData(line){
    var data = {
        date:null,
        level:null,
        // src:null,
        text:null
    };
    if (line) {
        var splitedStrs = line.split("] ");
        //去掉 \u001b[32m 字样
        var isFirst = false;
        for (var i = 0; i < splitedStrs.length; i++) {
            splitedStrs[i] = splitedStrs[i].replace(/[\u001b]\[[1-9]\dm/ig, '');
            if ((i === 0 || i === 1) && splitedStrs[i].indexOf('[') === 0 && (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{3}/ig.test(splitedStrs[i]) || /LOG|INFO|DEBUG|WARN|ERROR|TRACE|FATAL/g.test(splitedStrs[i]))) {
                splitedStrs[i] = splitedStrs[i].slice(1);
                isFirst = true;
            }
        }
        if (isFirst) {
            data.date = splitedStrs.splice(0,1)[0];
            data.level = splitedStrs.splice(0,1)[0];
        }
        data.text = splitedStrs.join('');
        infos.push(data);
    }
}

/**
 * 根绝搜集分析好的数据 组装 并插入数据库
 * @param {*} infos 
 * @param {*} conn 
 */
function insert(infos,conn){
    var datas = [],previous = null;
    var sql = "insert into `log` (`date`,`level`,`desc`) values(?,?,?)";
    for (var m = 0; m < infos.length; m++) {
        var info = infos[m];
        if (m === 0) {
            previous = info;
        } else {
            if (info.date && info.level) {
                datas.push({
                    sql:sql,
                    params:[previous.date,previous.level,previous.text]
                });
                previous = info;
            } else {
                info.date = info.date || '';
                info.level = info.level || '';
                info.text = info.text || '';
                previous.text =previous.text+info.date+ info.level+ info.text;
            }
        }
    }
    if(previous){
        datas.push({
            sql:sql,
            params:[previous.date,previous.level,previous.text]
        });
    }
    // console.log(JSON.stringify(datas))
    // console.log(datas)
    async.forEachSeries(datas,function(data,cb){
        conn.query(data.sql,data.params,function(err,res){
            cb(err);
        })
    },function(err){
        console.log('=====插入数据库完成=====',err)
    });
}