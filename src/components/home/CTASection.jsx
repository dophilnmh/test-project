'use client';
import { motion } from 'framer-motion';

import { ArrowRight, Check, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const eligibilityPoints = [
  'Former student of Kendu Adventist School of Medical Sciences',
  'Committed to annual contribution of KES 6,000',
  'Willing to complete 6-month probationary period',
  'Ready to participate in community building',
];

export const CTASection = () => {
  return (
    <section id="contact" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* CTA Content */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">
                <span className="gold-gradient-text">Ready to Join?</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Become part of a community of medical professionals building
                wealth together. Your journey to financial empowerment starts
                here.
              </p>

              <div className="space-y-4 mb-8">
                {eligibilityPoints.map((point, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-muted-foreground">{point}</span>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Link href="/member">
                    Apply for Membership
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-primary/50 text-foreground hover:bg-primary/10"
                >
                  <Link href="/about">Learn More About Us</Link>
                </Button>
              </div>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="card-premium p-8"
            >
              <h3 className="text-xl font-semibold text-foreground mb-6">
                Get In Touch
              </h3>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Email Us</p>
                    <a
                      href="mailto:nimblypolls@gmail.com"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      nimblypolls@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Call Us</p>
                    <a
                      href="tel:0759673053"
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      0759 673 053
                    </a>
                    <p className="text-xs text-muted-foreground">
                      WhatsApp: 0759 673 053
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Visit Us</p>
                    <p className="text-muted-foreground">
                      West End Towers, Waiyaki Way, Nairobi
                    </p>
                    <p className="text-muted-foreground">
                      Mega Plaza, Oginga Odinga Street, Kisumu
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  <span className="text-primary font-medium">
                    Office Hours:
                  </span>
                  <br />
                  Monday - Friday: 9:00 AM - 5:00 PM EAT
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
