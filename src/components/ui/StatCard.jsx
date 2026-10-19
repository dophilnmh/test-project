import { motion } from "framer-motion";

export const StatCard = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="stat-card"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-sm font-medium">{title}</p>
          <p className="text-2xl lg:text-3xl font-bold text-foreground mt-1">
            {value}
          </p>
          {description && (
            <p className="text-muted-foreground text-xs mt-1">{description}</p>
          )}
          {trend && (
            <p
              className={`text-xs mt-2 ${
                trend.isPositive ? "text-success" : "text-destructive"
              }`}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% from last
              month
            </p>
          )}
        </div>
        <div className="p-3 rounded-xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </motion.div>
  );
};
