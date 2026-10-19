"use client";
import { motion } from "framer-motion";

import { Clock, MapPin, Video, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { upcomingEvents } from "@/app/data/mockData";

const typeConfig = {
  physical: {
    label: "In-Person",
    icon: Users,
    color: "bg-green-500/10 text-green-400 border-green-500/30",
  },
  hybrid: {
    label: "Hybrid",
    icon: Video,
    color: "bg-primary/10 text-primary border-primary/30",
  },
  virtual: {
    label: "Virtual",
    icon: Video,
    color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
};

export const EventsSection = () => {
  return (
    <section id="events" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            <span className="gold-gradient-text">Upcoming Events</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Join us at our bi-annual meetings in June and December, plus other
            networking opportunities.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {upcomingEvents.map((event, index) => {
            const config = typeConfig[event.type];
            const eventDate = new Date(event.date);
            const monthShort = eventDate.toLocaleDateString("en-US", {
              month: "short",
            });
            const day = eventDate.getDate();

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="card-premium p-6 group hover:border-primary/50 transition-all"
              >
                <div className="flex gap-4">
                  {/* Date Box */}
                  <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-primary/10 flex flex-col items-center justify-center border border-primary/30">
                    <span className="text-xs font-medium text-primary uppercase">
                      {monthShort}
                    </span>
                    <span className="text-2xl font-bold text-foreground">
                      {day}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <Badge className={`${config.color} border mb-2`}>
                      <config.icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                    <h3 className="font-semibold text-foreground text-lg leading-tight mb-1 line-clamp-2">
                      {event.title}
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mt-4 mb-4 line-clamp-2">
                  {event.description}
                </p>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="line-clamp-1">{event.location}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* AGM Note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <div className="card-premium inline-block px-8 py-4 max-w-2xl">
            <p className="text-muted-foreground text-sm">
              <span className="text-primary font-medium">
                Annual General Meetings:
              </span>{" "}
              The association holds two mandatory AGMs per year - in June for
              mid-year review and December for annual reports and leadership
              elections. Both physical attendance and virtual participation are
              supported.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
