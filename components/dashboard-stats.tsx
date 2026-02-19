'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, TrendingUp, Zap, Database, Clock, Server } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface Stats {
  totalQueries: number;
  cacheHitRate: number;
  averageResponseTime: number;
  queriesPerMinute: number;
  uptimeFormatted: string;
  upstreamServers: Array<{
    name: string;
    queries: number;
    avgResponseTime: number;
  }>;
  queryTypeDistribution: Record<string, number>;
  recentQueries: Array<any>;
  cache: {
    size: number;
  };
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
      setLoading(false);
    } catch (error) {
      console.error('[v0] Failed to fetch stats:', error);
    }
  };

  if (loading || !stats) {
    return (
      <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-blue-100 animate-pulse">
            <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4">
              <div className="h-3 sm:h-4 w-16 sm:w-20 bg-blue-100 rounded" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="h-6 sm:h-8 w-12 sm:w-16 bg-blue-100 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 主要统计卡片 */}
      <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-blue-900">总查询数</CardTitle>
            <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">
              {stats.totalQueries.toLocaleString()}
            </div>
            <p className="text-xs text-blue-500 mt-0.5 sm:mt-1">
              {stats.queriesPerMinute.toFixed(1)} 查询/分钟
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-green-900">缓存命中率</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">
              {stats.cacheHitRate.toFixed(1)}%
            </div>
            <Progress value={stats.cacheHitRate} className="mt-1 sm:mt-2 h-1.5 sm:h-2" />
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-purple-900">平均响应</CardTitle>
            <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600">
              {stats.averageResponseTime.toFixed(0)}ms
            </div>
            <p className="text-xs text-purple-500 mt-0.5 sm:mt-1">
              高速解析
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-orange-900">运行时间</CardTitle>
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-base sm:text-lg font-bold text-orange-600">
              {stats.uptimeFormatted}
            </div>
            <p className="text-xs text-orange-500 mt-0.5 sm:mt-1">
              持续稳定运行
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 上游服务器统计 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader className="p-3 sm:p-4 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-900 text-sm sm:text-base">
            <Server className="w-4 h-4 sm:w-5 sm:h-5" />
            上游DNS服务器状态
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">各上游服务器的查询分布和性能</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="space-y-2 sm:space-y-3">
            {stats.upstreamServers.map((server, index) => (
              <div key={index} className="flex items-center justify-between p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full shrink-0 ${
                    server.queries > 0 ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-blue-900 text-sm truncate">{server.name}</p>
                    <p className="text-xs text-blue-600">
                      {server.queries} 次查询
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <Badge variant="outline" className="bg-white text-xs">
                    {server.avgResponseTime.toFixed(0)}ms
                  </Badge>
                </div>
              </div>
            ))}
            {stats.upstreamServers.length === 0 && (
              <p className="text-center text-blue-500 py-4 text-sm">暂无查询数据</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 查询类型分布 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader className="p-3 sm:p-4 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-900 text-sm sm:text-base">
            <Database className="w-4 h-4 sm:w-5 sm:h-5" />
            查询类型分布
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">不同DNS记录类型的查询统计</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {Object.entries(stats.queryTypeDistribution).map(([type, count]) => (
              <div key={type} className="p-2 sm:p-3 bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600 font-medium">{type}</p>
                <p className="text-base sm:text-lg lg:text-xl font-bold text-blue-900">{count}</p>
              </div>
            ))}
            {Object.keys(stats.queryTypeDistribution).length === 0 && (
              <div className="col-span-full text-center text-blue-500 py-4 text-sm">
                暂无查询数据
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 最近查询 */}
      <Card className="border-blue-100 shadow-md">
        <CardHeader className="p-3 sm:p-4 sm:pb-3">
          <CardTitle className="text-blue-900 text-sm sm:text-base">最近查询</CardTitle>
          <CardDescription className="text-xs sm:text-sm">实时查询记录流</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="space-y-1 sm:space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
            {stats.recentQueries.slice(0, 10).map((query) => (
              <div key={query.id} className="flex items-center justify-between p-1.5 sm:p-2 hover:bg-blue-50 rounded-lg transition-colors">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <Badge variant={query.cached ? 'secondary' : 'default'} className="shrink-0 text-xs">
                    {query.type}
                  </Badge>
                  <span className="font-medium text-blue-900 truncate text-xs sm:text-sm">{query.domain}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {query.cached && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs hidden sm:inline-flex">
                      缓存
                    </Badge>
                  )}
                  <span className="text-xs text-blue-600">{query.responseTime}ms</span>
                </div>
              </div>
            ))}
            {stats.recentQueries.length === 0 && (
              <p className="text-center text-blue-500 py-6 sm:py-8 text-sm">暂无查询记录</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
