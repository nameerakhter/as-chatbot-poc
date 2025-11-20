import { motion } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';

type MagicAIResponseProps = {
  children: React.ReactNode;
  isCreatedByUser: boolean;
};

export default function AIResponse({ children, isCreatedByUser }: MagicAIResponseProps) {
  if (isCreatedByUser) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        ease: [0.23, 1, 0.32, 1],
        staggerChildren: 0.1,
      }}
      className="group relative my-4 w-full"
    >
      <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 opacity-0 blur transition-all duration-500 group-hover:opacity-100" />

      <div className="relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 backdrop-blur-sm transition-all duration-300 hover:border-gray-300/50 hover:shadow-lg dark:border-gray-700/50 dark:bg-gray-900/80">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 border-b border-gray-100/50 px-6 py-4 dark:border-gray-700/50"
        >
          <motion.div
            animate={{
              rotate: [0, 5, -5, 0],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              repeatDelay: 2,
            }}
            className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg"
          >
            <Bot size={16} className="text-white" strokeWidth={2.5} />

            <motion.div
              animate={{
                scale: [0, 1, 0],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
              }}
              className="absolute -right-1 -top-1"
            >
              <Sparkles size={12} className="text-yellow-400" />
            </motion.div>
          </motion.div>

          <div className="flex flex-col">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-sm font-semibold text-transparent dark:from-blue-400 dark:to-purple-400">
              {'Apuni Sarkar Assistant'}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative p-6"
        >
          <div
            className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
              backgroundSize: '20px 20px',
            }}
          />

          <div className="prose prose-gray dark:prose-invert relative z-10 max-w-none">
            {children}
          </div>
        </motion.div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [-20, -100],
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 2,
              ease: 'easeOut',
            }}
            className="absolute h-1 w-1 rounded-full bg-blue-400/60"
            style={{
              left: `${20 + i * 30}%`,
              bottom: '10px',
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
