# LogAnalyst4js
pomelo pm2 log analyst 
目前我们项目上是使用pm2 管理整个pomelo工程。
每个pm2维护的app进程都会生成一个log文件，这样的话对程序寻找线上bug的时候非常不友好。
此程序通过分析每个日志，然后汇总插入到数据库 这样就可以使用数据库根据时间进行排序，
对用户整个操作操作流程进行整合，方便分析整个错误原因的产生，
也可以根据level来统计某段时间内错误的数量。
