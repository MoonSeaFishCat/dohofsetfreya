'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Cloud, TrendingUp, Zap, Server, Database, LogOut } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DashboardStats } from '@/components/dashboard-stats';
import { DNSQueryTool } from '@/components/dns-query-tool';
import { QueryLogs } from '@/components/query-logs';
import { ConfigurationPanel } from '@/components/configuration-panel';
import { AnimatedBackground } from '@/components/animated-background';
import { CloudIcon } from '@/components/cloud-icon';
import { isAuthenticated, clearAuthToken } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuth, setIsAuth] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      if (!isAuthenticated()) {
        router.push('/login');
      } else {
        setIsAuth(true);
      }
      setIsChecking(false);
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    clearAuthToken();
    router.push('/login');
  };

  if (isChecking || !isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-blue-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <AnimatedBackground />
      {/* 顶部标题区域 */}
      <header className="border-b border-blue-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 animate-float">
                <CloudIcon className="w-full h-full" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-blue-900 text-balance">
                  圣芙蕾雅学院云端DNS加密服务中心
                </h1>
                <p className="text-sm text-blue-600 mt-0.5">
                  提供安全、快速的DNS over HTTPS (DoH)加密解析服务
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium text-green-700">服务运行中</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="border-blue-200 hover:bg-blue-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                登出
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-blue-100 p-1 shadow-sm">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Activity className="w-4 h-4 mr-2" />
              实时监控
            </TabsTrigger>
            <TabsTrigger value="query" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Zap className="w-4 h-4 mr-2" />
              DNS查询
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Database className="w-4 h-4 mr-2" />
              日志统计
            </TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Server className="w-4 h-4 mr-2" />
              配置管理
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <DashboardStats />
          </TabsContent>

          <TabsContent value="query" className="space-y-6">
            <DNSQueryTool />
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <QueryLogs />
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <ConfigurationPanel />
          </TabsContent>
        </Tabs>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-blue-100 bg-white/80 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-blue-600">
          <p>圣芙蕾雅学院云端DNS加密服务中心 · 由 v0 强力驱动</p>
        </div>
      </footer>
    </div>
  );
}
