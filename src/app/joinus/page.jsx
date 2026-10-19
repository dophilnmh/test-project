'use client';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

import { motion } from 'framer-motion';
import {
  UserPlus,
  GraduationCap,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  CheckCircle2,
  Clock,
  Users,
  Shield,
  FileText,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { Layout } from '@/components/layout/Layout';

const membershipBenefits = [
  {
    icon: Users,
    title: 'Network Access',
    description: 'Connect with fellow KASMS alumni worldwide',
  },
  {
    icon: Shield,
    title: 'Financial Support',
    description: 'Access to loans up to 50% of your contributions',
  },
  {
    icon: Calendar,
    title: 'Exclusive Events',
    description: 'Bi-annual meetings and social gatherings',
  },
  {
    icon: GraduationCap,
    title: 'Professional Growth',
    description: 'Mentorship and career development opportunities',
  },
];

const applicationSteps = [
  {
    step: 1,
    title: 'Submit Application',
    description: 'Fill out the membership form with your details',
  },
  {
    step: 2,
    title: 'Document Verification',
    description: 'Our team verifies your KASMS alumni status',
  },
  {
    step: 3,
    title: 'Probation Period',
    description: '6-month probationary membership begins',
  },
  {
    step: 4,
    title: 'Full Membership',
    description: 'Approved by two-thirds vote after probation',
  },
];

const JoinUs = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    graduationYear: '',
    course: '',
    currentOccupation: '',
    employer: '',
    location: '',
    reason: '',
    referredBy: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!agreedToTerms) {
      toast({
        title: 'Terms Required',
        description: 'Please agree to the terms and conditions to proceed.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    toast({
      title: 'Application Submitted!',
      description:
        "Thank you for your interest. We'll review your application and contact you soon.",
    });

    setIsSubmitting(false);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      graduationYear: '',
      course: '',
      currentOccupation: '',
      employer: '',
      location: '',
      reason: '',
      referredBy: '',
    });
    setAgreedToTerms(false);
  };

  // Generate graduation years (last 50 years)
  const currentYear = new Date().getFullYear();
  const graduationYears = Array.from({ length: 50 }, (_, i) =>
    (currentYear - i).toString()
  );

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-20 bg-linear-to-br from-primary/10 via-background to-secondary/10 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <UserPlus className="w-3 h-3 mr-1" />
              Membership Application
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Join the KAH Alumni Family
            </h1>
            <p className="text-lg text-muted-foreground">
              Become part of a thriving community of KASMS graduates dedicated
              to mutual support, professional growth, and lasting friendships.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Why Join Us?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Unlock exclusive benefits and be part of our growing alumni
              network
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {membershipBenefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full text-center hover:shadow-lg transition-shadow border-primary/10">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <benefit.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Process */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Application Process
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Follow these simple steps to become a member of KAH Alumni
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {applicationSteps.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                {index < applicationSteps.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-0.5 bg-primary/20"></div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Card className="border-primary/10 shadow-xl">
                <CardHeader className="text-center border-b bg-primary/5">
                  <CardTitle className="text-2xl flex items-center justify-center gap-2">
                    <FileText className="w-6 h-6 text-primary" />
                    Membership Application Form
                  </CardTitle>
                  <CardDescription>
                    Please fill out all required fields accurately. Fields
                    marked with * are required.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-8">
                  <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Personal Information */}
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-primary" />
                        Personal Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name *</Label>
                          <Input
                            id="firstName"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            placeholder="Enter your first name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name *</Label>
                          <Input
                            id="lastName"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            placeholder="Enter your last name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address *</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              value={formData.email}
                              onChange={handleInputChange}
                              placeholder="your.email@example.com"
                              className="pl-10"
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone Number *</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="phone"
                              name="phone"
                              type="tel"
                              value={formData.phone}
                              onChange={handleInputChange}
                              placeholder="+254 7XX XXX XXX"
                              className="pl-10"
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="location">Current Location *</Label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="location"
                              name="location"
                              value={formData.location}
                              onChange={handleInputChange}
                              placeholder="City, Country"
                              className="pl-10"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Academic Information */}
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-primary" />
                        KASMS Academic Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="graduationYear">
                            Year of Graduation *
                          </Label>
                          <Select
                            value={formData.graduationYear}
                            onValueChange={(value) =>
                              handleSelectChange('graduationYear', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent>
                              {graduationYears.map((year) => (
                                <SelectItem key={year} value={year}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="course">Course/Program *</Label>
                          <Select
                            value={formData.course}
                            onValueChange={(value) =>
                              handleSelectChange('course', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select course" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nursing">Nursing</SelectItem>
                              <SelectItem value="clinical-medicine">
                                Clinical Medicine
                              </SelectItem>
                              <SelectItem value="laboratory">
                                Medical Laboratory
                              </SelectItem>
                              <SelectItem value="pharmacy">Pharmacy</SelectItem>
                              <SelectItem value="public-health">
                                Public Health
                              </SelectItem>
                              <SelectItem value="nutrition">
                                Nutrition & Dietetics
                              </SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Professional Information */}
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-primary" />
                        Professional Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentOccupation">
                            Current Occupation *
                          </Label>
                          <Input
                            id="currentOccupation"
                            name="currentOccupation"
                            value={formData.currentOccupation}
                            onChange={handleInputChange}
                            placeholder="e.g., Registered Nurse"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="employer">Current Employer</Label>
                          <Input
                            id="employer"
                            name="employer"
                            value={formData.employer}
                            onChange={handleInputChange}
                            placeholder="Organization/Hospital name"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Additional Information */}
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        Additional Information
                      </h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="reason">
                            Why do you want to join KAH Alumni? *
                          </Label>
                          <Textarea
                            id="reason"
                            name="reason"
                            value={formData.reason}
                            onChange={handleInputChange}
                            placeholder="Tell us about your motivation to join and how you hope to contribute to the community..."
                            rows={4}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="referredBy">
                            Referred by (if any)
                          </Label>
                          <Input
                            id="referredBy"
                            name="referredBy"
                            value={formData.referredBy}
                            onChange={handleInputChange}
                            placeholder="Name of existing member who referred you"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Terms and Conditions */}
                    <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="terms"
                          checked={agreedToTerms}
                          onCheckedChange={(checked) =>
                            setAgreedToTerms(checked)
                          }
                        />
                        <div className="space-y-1">
                          <Label
                            htmlFor="terms"
                            className="text-sm font-medium cursor-pointer"
                          >
                            I agree to the terms and conditions *
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            By submitting this application, I confirm that I am
                            a former student of Kendu Adventist School of
                            Medical Sciences (KASMS) and agree to abide by the
                            KAH Alumni constitution and bylaws. I understand
                            that membership is subject to verification and
                            approval, with an annual contribution of KES 6,000
                            payable by the first week of June.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-center pt-4">
                      <Button
                        type="submit"
                        size="lg"
                        className="min-w-50"
                        disabled={isSubmitting || !agreedToTerms}
                      >
                        {isSubmitting ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Submit Application
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-8 text-center"
            >
              <p className="text-muted-foreground">
                Have questions about membership? Contact us at{' '}
                <a
                  href="mailto:nimblypolls@gmail.com"
                  className="text-primary hover:underline"
                >
                  nimblypolls@gmail.com
                </a>{' '}
                or call{' '}
                <a
                  href="tel:0759673053"
                  className="text-primary hover:underline"
                >
                  0759 673 053
                </a>
              </p>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default JoinUs;
