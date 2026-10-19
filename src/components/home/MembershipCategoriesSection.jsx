"use client";
import { motion } from "framer-motion";
import { membershipCategories } from "@/app/data/mockData";
import { Check, UserCheck, Users, UserPlus } from "lucide-react";

const categoryIcons = {
  "Full Members": UserCheck,
  "Associate Members": Users,
  "Probationary Members": UserPlus,
};

export const MembershipCategoriesSection = () => {
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
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            <span className="gold-gradient-text">Membership Categories</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Understanding the different tiers of membership and their associated
            privileges.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {membershipCategories.map((category, index) => {
            const IconComponent = categoryIcons[category.title] || UserCheck;
            const isHighlighted = category.title === "Full Members";

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`card-premium p-6 ${
                  isHighlighted
                    ? "border-primary/50 relative overflow-hidden"
                    : ""
                }`}
              >
                {isHighlighted && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium">
                    Recommended
                  </div>
                )}

                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                    isHighlighted ? "bg-primary/20" : "bg-secondary"
                  }`}
                >
                  <IconComponent
                    className={`h-7 w-7 ${
                      isHighlighted ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </div>

                <h3
                  className={`text-xl font-semibold mb-2 ${
                    isHighlighted ? "text-primary" : "text-foreground"
                  }`}
                >
                  {category.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {category.description}
                </p>

                <div className="space-y-3">
                  {category.privileges.map((privilege, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check
                        className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                          isHighlighted
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {privilege}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
