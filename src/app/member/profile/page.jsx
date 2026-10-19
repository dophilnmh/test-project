"use client";
import { motion } from "framer-motion";
import { MemberLayout } from "@/components/member/MemberLayout";

import { User, Mail, Phone, Calendar, Shield, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { members } from "@/app/data/mockData";

const currentMember = members[0];

const MemberProfile = () => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-foreground">
          My Profile
        </h1>
        <p className="text-muted-foreground">
          View and manage your account information
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="card-premium p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mx-auto mb-4 flex items-center justify-center border-2 border-primary/30">
            <span className="text-3xl font-bold text-primary">
              {currentMember.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {currentMember.name}
          </h2>
          <p className="text-primary text-sm font-medium mt-1">
            Member #{currentMember.membershipNumber}
          </p>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full mt-4 ${
              currentMember.status === "compliant"
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning"
            }`}
          >
            <CheckCircle className="h-3 w-3" />
            <span className="text-xs font-medium capitalize">
              {currentMember.status}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 card-premium p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">
            Account Information
          </h3>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-medium text-foreground">
                  {currentMember.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email Address</p>
                <p className="font-medium text-foreground">
                  {currentMember.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone Number</p>
                <p className="font-medium text-foreground">
                  {currentMember.phone}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Member Since</p>
                <p className="font-medium text-foreground">
                  {new Date(currentMember.joinDate).toLocaleDateString(
                    "en-US",
                    {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Membership Number
                </p>
                <p className="font-medium text-foreground">
                  {currentMember.membershipNumber}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button variant="outline" className="w-full sm:w-auto">
              Request Profile Update
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MemberProfile;
