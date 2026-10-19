"use client";
import { motion } from "framer-motion";
import { leaders } from "@/app/data/mockData";
import { Crown, Star, GraduationCap, Calendar, Briefcase } from "lucide-react";

export const LeadershipSection = () => {
  return (
    <section className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            <span className="gold-gradient-text">Meet Our Leadership</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Dedicated medical professionals serving two-year renewable terms to
            guide KAH Alumni towards collective prosperity.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {leaders.map((leader, index) => (
            <motion.div
              key={leader.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card-premium p-6 text-center group hover:border-primary/50 transition-all"
            >
              {/* Avatar Placeholder */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mx-auto mb-4 flex items-center justify-center border-2 border-primary/30 group-hover:border-primary/60 transition-colors">
                {index === 0 ? (
                  <Crown className="h-10 w-10 text-primary" />
                ) : (
                  <Star className="h-10 w-10 text-primary" />
                )}
              </div>

              <h3 className="text-lg font-semibold text-foreground">
                {leader.name}
              </h3>
              <p className="text-primary text-sm font-medium mt-1">
                {leader.position}
              </p>

              <div className="mt-4 space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5 text-primary" />
                  <span>Class of {leader.graduationYear}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Member since {new Date(leader.joinDate).getFullYear()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                  <span>{leader.specialization}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {leader.currentRole}
                </p>
              </div>

              <div className="mt-3">
                <span className="inline-block px-3 py-1 text-xs bg-primary/10 text-primary rounded-full">
                  Term: {leader.term}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
