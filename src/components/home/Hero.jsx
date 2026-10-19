"use client";
import { motion } from "framer-motion";
import { ArrowRight, Users, Wallet, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { summaryStats } from "@/app/data/mockData";

import Link from "next/link";

export const Hero = () => {
  const stats = [
    {
      icon: Users,
      label: "Active Members",
      value: `${summaryStats.totalMembers}+`,
    },
    {
      icon: Wallet,
      label: "Share Capital",
      value: `KES ${(summaryStats.shareCapital / 1000).toFixed(0)}K`,
    },
    {
      icon: Calendar,
      label: "Annual Meetings",
      value: `${summaryStats.annualMeetings}x`,
    },
    {
      icon: Clock,
      label: "Years Active",
      value: `${summaryStats.yearsActive}+`,
    },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-secondary/20" />

      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="absolute top-1/3 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <img
              src="/assets/kah-logo.jpg"
              alt="KAH Alumni"
              className="h-28 md:h-36 mx-auto gold-glow rounded-lg"
            />
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold mb-4"
          >
            <span className="text-foreground">KAH Alumni</span>
            <br />
            <span className="gold-gradient-text">Group Company Limited</span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-2xl md:text-3xl text-primary font-serif italic mb-6"
          >
            Together We Thrive
          </motion.p>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-muted-foreground text-base md:text-lg max-w-3xl mx-auto mb-8 leading-relaxed"
          >
            An alumni association for{" "}
            <span className="text-foreground font-medium">
              Kendu Adventist School of Medical Sciences
            </span>
            , fostering lifelong bonds among alumni through collaborative
            investments, professional development, and meaningful community
            impact since 2018.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Button
              asChild
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8"
            >
              <Link href="/joinus">
                Join Our Community
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-primary/50 text-foreground hover:bg-primary/10 text-base px-8"
            >
              <a href="#membership">Learn About Membership</a>
            </Button>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="card-premium p-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.8 + index * 0.1 }}
              >
                <stat.icon className="h-7 w-7 text-primary mx-auto mb-3" />
                <p className="text-2xl md:text-3xl font-bold text-foreground">
                  {stat.value}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-secondary/30 to-transparent" />
    </section>
  );
};
