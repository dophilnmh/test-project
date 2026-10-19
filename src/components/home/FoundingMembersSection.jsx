"use client";
import { foundingMembers } from "@/app/data/mockData";
import { motion } from "framer-motion";

import { Users, Award } from "lucide-react";

export const FoundingMembersSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
            <Award className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary font-medium">Est. 2018</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            <span className="gold-gradient-text">Founding Members</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Meet the visionary individuals who laid the foundation for KAH
            Alumni Group Company Limited, turning a simple savings idea into a
            thriving financial community.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {foundingMembers.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card-premium p-6 group hover:border-primary/50 transition-all"
            >
              {/* Avatar */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex-shrink-0 flex items-center justify-center border-2 border-primary/30 group-hover:border-primary/60 transition-colors">
                  <span className="text-xl font-bold text-primary">
                    {member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {member.name}
                  </h3>
                  <p className="text-primary text-sm font-medium">
                    {member.role}
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground text-sm leading-relaxed">
                {member.bio}
              </p>

              <div className="mt-4 pt-4 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  <span className="text-primary">Member since:</span> March 2018
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Founding Story */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 max-w-4xl mx-auto"
        >
          <div className="card-premium p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-serif font-bold text-foreground mb-4">
              Our Founding Story
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              In March 2018, six visionary alumni came together with a shared
              dream — to create a platform where members could pool resources,
              support each other financially, and build lasting wealth together.
              What started as informal monthly contributions of KES 6,000 has
              grown into a registered company with robust lending services,
              helping members access emergency funds and achieve their financial
              goals. Today, KAH Alumni Group Company Limited stands as a
              testament to the power of unity and collective purpose.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
