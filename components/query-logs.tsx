'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    const interval = setInterval(fetchLogs, 5000); // 每5秒更新
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
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'timeout':
        return <Clock className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700 border-green-200">成功</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700 border-red-200">失败</Badge>;
      case 'timeout':
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">超时</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-100 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <FileText className="w-5 h-5" />
            查询日志
          </CardTitle>
          <CardDescription>
            实时DNS查询记录 · 最近50条
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-blue-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>暂无查询日志</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-blue-900">时间</TableHead>
                    <TableHead className="text-blue-900">域名</TableHead>
                    <TableHead className="text-blue-900">类型</TableHead>
                    <TableHead className="text-blue-900">状态</TableHead>
                    <TableHead className="text-blue-900">响应时间</TableHead>
                    <TableHead className="text-blue-900">缓存</TableHead>
                    <TableHead className="text-blue-900">上游</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-blue-50">
                      <TableCell className="text-sm text-blue-700">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium text-blue-900 max-w-xs truncate">
                        {log.domain}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50">
                          {log.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          {getStatusBadge(log.status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="secondary">{log.responseTime}ms</Badge>
                      </TableCell>
                      <TableCell>
                        {log.cached ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            是
                          </Badge>
                        ) : (
                          <Badge variant="outline">否</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-blue-700">
                        {log.upstream || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* 日志统计摘要 */}
      {logs.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-blue-900">成功率</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {((logs.filter(l => l.status === 'success').length / logs.length) * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-900">缓存命中</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {logs.filter(l => l.cached).length} / {logs.length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-100 bg-gradient-to-br from-purple-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-purple-900">平均响应</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {(logs.reduce((sum, l) => sum + l.responseTime, 0) / logs.length).toFixed(0)}ms
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
