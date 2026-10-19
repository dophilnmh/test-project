"use client";
import { motion } from "framer-motion";
import {
  Check,
  Users,
  Clock,
  Shield,
  Vote,
  Wallet,
  AlertCircle,
} from "lucide-react";

const benefits = [
  { icon: Users, text: "Open membership to all former KASMS students" },
  { icon: Clock, text: "Six-month probation period for new applicants" },
  {
    icon: Users,
    text: "Associate membership for spouses & adult children (max 20% of total)",
  },
  {
    icon: Wallet,
    text: "Annual dues of KES 6,000 payable by first week of June",
  },
  { icon: Shield, text: "Limited liability protection for all members" },
  { icon: Vote, text: "Two-thirds vote required for membership approval" },
];

const requirements = [
  "Former student of Kendu Adventist School of Medical Sciences",
  "Complete membership application form",
  "Pay initial registration and first annual contribution",
  "Complete six-month probationary period",
  "Receive approval by two-thirds majority vote",
  "Maintain good standing through regular contributions",
];

export const MembershipSection = () => {
  return (
    <section id="membership" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            <span className="gold-gradient-text">
              Membership Structure & Benefits
            </span>
          </h2>
          <p className="text-muted-foreground max-w-3xl mx-auto text-lg">
            Join a community of medical professionals committed to mutual
            financial growth and professional excellence.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Benefits Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="card-premium p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                Member Benefits
              </h3>
            </div>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <benefit.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-muted-foreground">{benefit.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Requirements Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="card-premium p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-primary/10">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                Eligibility Requirements
              </h3>
            </div>
            <div className="space-y-4">
              {requirements.map((requirement, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                  </div>
                  <span className="text-muted-foreground">{requirement}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 max-w-4xl mx-auto"
        >
          <div className="card-premium p-6 border-primary/30 bg-primary/5">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-2">
                  Membership Dismissal Policy
                </h4>
                <p className="text-sm text-muted-foreground">
                  Members may be dismissed by a two-thirds vote of the general
                  assembly for violations of the associations bylaws,
                  non-payment of dues for more than 12 months, or conduct
                  unbecoming of a medical professional. Dismissed members may
                  appeal within 30 days.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
