import type { Transition, Variants } from "framer-motion";

export const easeOut: Transition["ease"] = [0.16, 1, 0.3, 1];
export const easeInOut: Transition["ease"] = [0.65, 0, 0.35, 1];
export const spring: Transition = { type: "spring", stiffness: 420, damping: 32 };
export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 24 };

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: easeInOut } },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: easeOut } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.14, ease: easeInOut } },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: easeOut } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.14, ease: easeInOut } },
};

export const scaleFadeIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.18, ease: easeOut } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: easeInOut } },
};

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.16 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: easeOut },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 4,
    transition: { duration: 0.14, ease: easeInOut },
  },
};

export const drawerContent: Variants = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: { duration: 0.28, ease: easeOut } },
  exit: { x: "100%", transition: { duration: 0.2, ease: easeInOut } },
};

export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: easeOut } },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.16, ease: easeInOut } },
};

export const shake: Variants = {
  initial: { x: 0 },
  shake: {
    x: [0, -8, 8, -6, 6, -3, 3, 0],
    transition: { duration: 0.4, ease: "easeInOut" },
  },
};

export const staggerContainer = (staggerDelay = 0.05): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: staggerDelay },
  },
});

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: easeOut } },
};

export const heightAuto: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: "auto", opacity: 1, transition: { duration: 0.22, ease: easeOut } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.18, ease: easeInOut } },
};

export const chevronRotate = (open: boolean) => ({ rotate: open ? 180 : 0 });

export const rowHover = { backgroundColor: "rgba(0,0,0,0.02)" };

export const cardHover = {
  y: -2,
  boxShadow: "0 8px 20px rgba(16,24,40,0.08)",
  transition: { duration: 0.16, ease: easeOut },
};

export const swatchHover = { scale: 1.08, transition: { duration: 0.14, ease: easeOut } };

export const pulse: Variants = {
  animate: {
    scale: [1, 1.12, 1],
    opacity: [1, 0.85, 1],
    transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
  },
};

export const spinTransition: Transition = {
  repeat: Infinity,
  ease: "linear",
  duration: 0.7,
};
