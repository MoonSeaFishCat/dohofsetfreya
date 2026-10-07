'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Zap, Server, Database, LogOut, Menu, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DashboardStats } from '@/components/dashboard-stats';
import { DNSQueryTool } from '@/components/dns-query-tool';
import { QueryLogs } from '@/components/query-logs';
import { ConfigurationPanel } from '@/components/configuration-panel';
import { AnimatedBackground } from '@/components/animated-background';
import { CloudIcon } from '@/components/cloud-icon';
import { clearAuthToken } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuth, setIsAuth] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) {
          router.push('/login');
          return;
        }
        if (!cancelled) {
          setIsAuth(true);
        }
      } catch {
        router.push('/login');
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      clearAuthToken();
      router.push('/login');
    }
  };

  const tabs = [
    { value: 'dashboard', label: '监控', icon: Activity },
    { value: 'query', label: '查询', icon: Zap },
    { value: 'logs', label: '日志', icon: Database },
    { value: 'config', label: '配置', icon: Server },
  ];


  if (isChecking || !isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-[#FFFBF6] to-rose-50/70">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-amber-700">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-[#FFFBF6] to-rose-50/70">
      <AnimatedBackground />

      {/* 顶部标题区域 */}
      <header className="border-b border-orange-100/80 bg-[#FFFCF8]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-14 sm:h-14 shrink-0 animate-float">
                <CloudIcon className="w-full h-full" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl lg:text-2xl font-bold text-amber-900 truncate">
                  圣芙蕾雅学院DNS服务中心
                </h1>
                <p className="text-xs sm:text-sm text-amber-700/80 truncate hidden sm:block">
                  安全、快速的DNS over HTTPS加密解析服务
                </p>
              </div>
            </div>

            {/* 桌面端状态和登出 */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-emerald-700">运行中</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="border-orange-200 hover:bg-orange-50 rounded-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                登出
              </Button>
            </div>

            {/* 移动端菜单按钮 */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden shrink-0"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>

          {/* 移动端下拉菜单 */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-3 pt-3 border-t border-orange-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-emerald-700">运行中</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="border-orange-200 hover:bg-orange-50 rounded-full"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  登出
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          {/* 移动端底部导航 */}
          <div className="fixed bottom-0 left-0 right-0 bg-[#FFFCF8] border-t border-orange-100 z-20 md:hidden">
            <div className="grid grid-cols-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`flex flex-col items-center justify-center py-2 transition-colors ${
                      activeTab === tab.value
                        ? 'text-orange-500 bg-orange-50'
                        : 'text-stone-400 hover:text-orange-500'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs mt-1">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 桌面端标签栏 */}
          <TabsList className="hidden md:flex bg-white border border-orange-100 p-1 shadow-soft w-full justify-start overflow-x-auto rounded-2xl">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-orange-400 data-[state=active]:text-white flex items-center gap-2 whitespace-nowrap rounded-xl"
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6 pb-20 md:pb-0">
            <DashboardStats />
          </TabsContent>

          <TabsContent value="query" className="space-y-4 sm:space-y-6 pb-20 md:pb-0">
            <DNSQueryTool />
          </TabsContent>

          <TabsContent value="logs" className="space-y-4 sm:space-y-6 pb-20 md:pb-0">
            <QueryLogs />
          </TabsContent>

          <TabsContent value="config" className="space-y-4 sm:space-y-6 pb-20 md:pb-0">
            <ConfigurationPanel />
          </TabsContent>
        </Tabs>
      </main>

      {/* 页脚 - 移动端隐藏 */}
      <footer className="hidden md:block border-t border-orange-100 bg-[#FFFCF8]/80 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-amber-700/80">
          <p>圣芙蕾雅学院云端DNS加密服务中心</p>
        </div>
      </footer>
    </div>
  );
}
