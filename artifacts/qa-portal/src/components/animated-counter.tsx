import { motion } from "framer-motion";

export function AnimatedCounter({ value, suffix = "" }: { value: number | string; suffix?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="inline-block"
    >
      {value}
      {suffix}
    </motion.span>
  );
}
