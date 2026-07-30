'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, CheckCircle, XCircle, Clock, Download } from 'lucide-react';

interface QueryLog {
  id: string;
  timestamp: number;
  domain: string;
  type: string;
  clientIp: string;
  responseTime: number;
  status: 'success' | 'error' | 'timeout' | 'blocked';
  cached: boolean;
  upstream?: string;
  answers?: string[];
}

export function QueryLogs() {
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [cached, setCached] = useState('all');
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      if (query.trim()) params.set('q', query.trim());
      if (type !== 'all') params.set('type', type);
      if (status !== 'all') params.set('status', status);
      if (cached !== 'all') params.set('cached', cached);

      const response = await fetch(`/api/logs?${params.toString()}`);
      if (!response.ok) throw new Error('获取日志失败');
      const data = await response.json();
      setLogs(data.logs || []);
      setLoading(false);
    } catch (error) {
      console.error('[logs] Failed to fetch logs:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const exportCsv = async () => {
    const params = new URLSearchParams();
    params.set('format', 'csv');
    if (query.trim()) params.set('q', query.trim());
    if (type !== 'all') params.set('type', type);
    if (status !== 'all') params.set('status', status);
    if (cached !== 'all') params.set('cached', cached);

    const response = await fetch(`/api/logs?${params.toString()}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dns-logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const filteredSummary = useMemo(() => ({
    total: logs.length,
    success: logs.filter((log) => log.status === 'success').length,
    cachedCount: logs.filter((log) => log.cached).length,
  }), [logs]);

  const getStatusIcon = (value: string) => {
    switch (value) {
      case 'success': return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />;
      case 'error': return <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />;
      case 'timeout': return <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />;
      case 'blocked': return <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (value: string) => {
    switch (value) {
      case 'success': return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">成功</Badge>;
      case 'error': return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">失败</Badge>;
      case 'timeout': return <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">超时</Badge>;
      case 'blocked': return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">拦截</Badge>;
      default: return <Badge variant="outline" className="text-xs">{value}</Badge>;
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
          <CardDescription className="text-xs sm:text-sm">支持搜索、筛选和导出</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <Input placeholder="搜索域名" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="类型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="AAAA">AAAA</SelectItem>
                <SelectItem value="CNAME">CNAME</SelectItem>
                <SelectItem value="MX">MX</SelectItem>
                <SelectItem value="TXT">TXT</SelectItem>
                <SelectItem value="NS">NS</SelectItem>
                <SelectItem value="SOA">SOA</SelectItem>
                <SelectItem value="PTR">PTR</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="error">失败</SelectItem>
                <SelectItem value="timeout">超时</SelectItem>
                <SelectItem value="blocked">拦截</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cached} onValueChange={setCached}>
              <SelectTrigger><SelectValue placeholder="缓存" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部缓存</SelectItem>
                <SelectItem value="true">仅缓存</SelectItem>
                <SelectItem value="false">仅直连</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { setPage(0); fetchLogs(); }}>筛选</Button>
              <Button variant="outline" onClick={exportCsv}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-blue-500">
              <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-sm">暂无查询日志</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="p-2 sm:p-3 bg-blue-50/50 rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-blue-50 text-xs shrink-0">{log.type}</Badge>
                        <span className="font-medium text-blue-900 text-xs sm:text-sm truncate">{log.domain}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-blue-600">
                        <span>{formatTimestamp(log.timestamp)}</span>
                        {log.cached && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">缓存</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {getStatusIcon(log.status)}
                      {getStatusBadge(log.status)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-blue-600">
                    <Badge variant="secondary" className="text-xs">{log.responseTime}ms</Badge>
                    {log.upstream && <span className="truncate hidden sm:inline">{log.upstream}</span>}
                    <span className="truncate hidden md:inline">{log.clientIp}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-4"><CardTitle className="text-xs sm:text-sm text-blue-900">当前页总数</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0"><div className="text-xl sm:text-2xl font-bold text-blue-600">{filteredSummary.total}</div></CardContent>
        </Card>
        <Card className="border-green-100 bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-4"><CardTitle className="text-xs sm:text-sm text-green-900">成功数</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0"><div className="text-xl sm:text-2xl font-bold text-green-600">{filteredSummary.success}</div></CardContent>
        </Card>
        <Card className="border-purple-100 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-4"><CardTitle className="text-xs sm:text-sm text-purple-900">缓存命中</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0"><div className="text-xl sm:text-2xl font-bold text-purple-600">{filteredSummary.cachedCount}</div></CardContent>
        </Card>
      </div>
    </div>
  );
}