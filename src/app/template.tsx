'use client';

import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10, transition: { duration: 0.28, ease: [0.55, 0, 1, 0.45] } }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      style={{ minHeight: '100%' }}
    >
      {children}
    </motion.div>
  );
}

