'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

interface QueryLog {
  id: string;
  timestamp: number;
  domain: string;
  type: string;
  clientIp: string;
  responseTime: number;
  status: 'success' | 'error' | 'timeout';
  cached: boolean;
  upstream?: string;
  answers?: string[];
}

export function QueryLogs() {
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/logs?limit=50');
      const data = await response.json();
      setLogs(data.logs || []);
      setLoading(false);
    } catch (error) {
      console.error('[v0] Failed to fetch logs:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />;
      case 'timeout':
        return <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">成功</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">失败</Badge>;
      case 'timeout':
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">超时</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-blue-100 shadow-md">
        <CardHeader className="p-3 sm:p-4 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-900 text-sm sm:text-base">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            查询日志
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            实时DNS查询记录 · 最近50条
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 sm:w-8 sm:h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-blue-500">
              <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm">暂无查询日志</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 sm:p-3 bg-blue-50/50 rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors"
                >
                  {/* 移动端卡片式布局 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-blue-50 text-xs shrink-0">
                          {log.type}
                        </Badge>
                        <span className="font-medium text-blue-900 text-xs sm:text-sm truncate">
                          {log.domain}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-blue-600">
                        <span>{formatTimestamp(log.timestamp)}</span>
                        {log.cached && (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                            缓存
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {getStatusIcon(log.status)}
                      {getStatusBadge(log.status)}
                    </div>
                  </div>
                  
                  {/* 响应时间和上游服务器 */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-blue-600">
                    <Badge variant="secondary" className="text-xs">{log.responseTime}ms</Badge>
                    {log.upstream && (
                      <span className="truncate hidden sm:inline">{log.upstream}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 日志统计摘要 */}
      {logs.length > 0 && (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm text-blue-900">成功率</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-blue-600">
                {((logs.filter(l => l.status === 'success').length / logs.length) * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm text-green-900">缓存命中</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-green-600">
                {logs.filter(l => l.cached).length} / {logs.length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-100 bg-gradient-to-br from-purple-50 to-white">
            <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm text-purple-900">平均响应</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-purple-600">
                {(logs.reduce((sum, l) => sum + l.responseTime, 0) / logs.length).toFixed(0)}ms
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
