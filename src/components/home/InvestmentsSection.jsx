"use client";
import { motion } from "framer-motion";
import {
  TrendingUp,
  PiggyBank,
  Landmark,
  HandCoins,
  Shield,
  BarChart3,
} from "lucide-react";

const investmentHighlights = [
  {
    icon: PiggyBank,
    title: "Share Capital",
    description:
      "Build equity through regular contributions to our growing share capital base.",
  },
  {
    icon: HandCoins,
    title: "Member Loans",
    description:
      "Access affordable loans at competitive interest rates to meet personal and professional needs.",
  },
  {
    icon: TrendingUp,
    title: "Dividend Distribution",
    description:
      "Receive annual dividends proportional to your shareholding and participation.",
  },
  {
    icon: Landmark,
    title: "Real Estate Investment",
    description:
      "Participate in collective property investments for long-term wealth creation.",
  },
  {
    icon: Shield,
    title: "Financial Security",
    description:
      "Enjoy the security of a registered company with proper governance structures.",
  },
  {
    icon: BarChart3,
    title: "Transparent Reporting",
    description:
      "Access detailed financial reports and participate in investment decisions.",
  },
];

export const InvestmentsSection = () => {
  return (
    <section id="investments" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            <span className="gold-gradient-text">Investment Opportunities</span>
          </h2>
          <p className="text-muted-foreground max-w-3xl mx-auto text-lg">
            Grow your wealth through strategic investments managed by your
            fellow medical professionals.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {investmentHighlights.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card-premium p-6 group hover:border-primary/50 transition-all text-center"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                <item.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
