'use client';

// 治愈系背景喵~ 软软的蜜桃云朵 + 暖阳光晕，让人心情变好 (◕ᴗ◕✿)
export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* 浮动云朵装饰 */}
      <div className="absolute top-20 left-[10%] w-32 h-16 bg-orange-200/40 rounded-full blur-2xl animate-float"
           style={{ animationDelay: '0s', animationDuration: '8s' }} />
      <div className="absolute top-40 right-[15%] w-40 h-20 bg-rose-200/30 rounded-full blur-2xl animate-float"
           style={{ animationDelay: '2s', animationDuration: '10s' }} />
      <div className="absolute top-60 left-[60%] w-36 h-18 bg-amber-200/35 rounded-full blur-2xl animate-float"
           style={{ animationDelay: '4s', animationDuration: '9s' }} />

      {/* 暖阳光晕 */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-amber-200/40 via-orange-200/25 to-transparent rounded-full blur-3xl" />

      {/* 底部光晕 */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-gradient-to-t from-orange-200/30 to-transparent rounded-full blur-3xl" />

      {/* 动画样式 */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          25% {
            transform: translateY(-20px) translateX(10px);
          }
          50% {
            transform: translateY(-10px) translateX(-10px);
          }
          75% {
            transform: translateY(-30px) translateX(5px);
          }
        }
        .animate-float {
          animation: float ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
