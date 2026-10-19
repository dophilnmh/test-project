"use client";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Search,
  Calendar,
  MessageSquare,
  Eye,
  Send,
  User,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

// Mock documents data (shared from admin)
const mockDocuments = [
  {
    id: "1",
    name: "Annual Report 2024.pdf",
    message:
      "Dear members, please find attached the annual report for 2024. This document contains our financial summary, achievements, and goals for the upcoming year.",
    category: "Reports",
    uploadedBy: "John Ochieng (Secretary)",
    uploadedAt: new Date("2024-01-15"),
    fileSize: "2.4 MB",
    isNew: true,
    comments: [
      {
        id: "c1",
        documentId: "1",
        author: "Jane Akinyi",
        content: "Great report! The investment section was very informative.",
        createdAt: new Date("2024-01-16"),
      },
    ],
  },
  {
    id: "2",
    name: "Meeting Minutes - January 2024.pdf",
    message:
      "Minutes from our monthly general meeting held on January 10th, 2024. Key decisions regarding new membership fees were discussed.",
    category: "Minutes",
    uploadedBy: "Mary Wanjiku (Secretary)",
    uploadedAt: new Date("2024-01-12"),
    fileSize: "856 KB",
    isNew: true,
    comments: [],
  },
  {
    id: "3",
    name: "Constitution Amendment Proposal.pdf",
    message:
      "Proposed amendments to our constitution. Please review and provide your feedback before the next AGM.",
    category: "Governance",
    uploadedBy: "Peter Kamau (Chairman)",
    uploadedAt: new Date("2024-01-08"),
    fileSize: "1.2 MB",
    isNew: false,
    comments: [
      {
        id: "c2",
        documentId: "3",
        author: "David Otieno",
        content: "I support the proposed changes to Article 5.",
        createdAt: new Date("2024-01-09"),
      },
      {
        id: "c3",
        documentId: "3",
        author: "Sarah Njeri",
        content:
          "Can we discuss the membership fee changes at the next meeting?",
        createdAt: new Date("2024-01-10"),
      },
    ],
  },
  {
    id: "4",
    name: "Investment Policy Guidelines.pdf",
    message:
      "Updated investment policy guidelines for member reference. This outlines how member contributions are invested.",
    category: "Policy",
    uploadedBy: "James Mwangi (Treasurer)",
    uploadedAt: new Date("2024-01-05"),
    fileSize: "945 KB",
    isNew: false,
    comments: [],
  },
  {
    id: "5",
    name: "Scholarship Application Form.pdf",
    message:
      "Members with children in school can apply for our education scholarship program. Application deadline is February 28th.",
    category: "Forms",
    uploadedBy: "Grace Achieng (Welfare)",
    uploadedAt: new Date("2024-01-03"),
    fileSize: "324 KB",
    isNew: false,
    comments: [
      {
        id: "c4",
        documentId: "5",
        author: "Michael Omondi",
        content:
          "Thank you for this opportunity. I will apply for my daughter.",
        createdAt: new Date("2024-01-04"),
      },
    ],
  },
];

const categories = [
  "All",
  "Reports",
  "Minutes",
  "Governance",
  "Policy",
  "Forms",
];

const MemberDocuments = () => {
  const [documents, setDocuments] = useState(mockDocuments);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [newComment, setNewComment] = useState("");
  const currentUser = "Jane Akinyi"; // Mock current user

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedDocument) return;

    const comment = {
      id: `c${Date.now()}`,
      documentId: selectedDocument.id,
      author: currentUser,
      content: newComment,
      createdAt: new Date(),
    };

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === selectedDocument.id
          ? { ...doc, comments: [...doc.comments, comment] }
          : doc
      )
    );

    setSelectedDocument((prev) =>
      prev ? { ...prev, comments: [...prev.comments, comment] } : null
    );

    setNewComment("");
  };

  const getCategoryColor = (category) => {
    const colors = {
      Reports: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      Minutes: "bg-green-500/10 text-green-600 border-green-500/20",
      Governance: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      Policy: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      Forms: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    };
    return colors[category] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          Documents
        </h1>
        <p className="text-muted-foreground mt-1">
          View shared documents and provide feedback to administrators
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={
                    selectedCategory === category ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredDocuments.map((doc) => (
          <Card key={doc.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg relative">
                    <FileText className="h-6 w-6 text-primary" />
                    {doc.isNew && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold truncate">
                        {doc.name}
                      </CardTitle>
                      {doc.isNew && (
                        <Badge
                          className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5"
                          variant="outline"
                        >
                          New
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {doc.fileSize}
                    </p>
                  </div>
                </div>
                <Badge
                  className={getCategoryColor(doc.category)}
                  variant="outline"
                >
                  {doc.category}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Message Preview */}
              <p className="text-sm text-muted-foreground line-clamp-2">
                {doc.message}
              </p>

              {/* Meta Info */}
              <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  <span>{doc.uploadedBy}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(doc.uploadedAt, "MMMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>
                    {doc.comments.length} comment
                    {doc.comments.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setSelectedDocument(doc)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDocuments.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No documents found
            </h3>
            <p className="text-muted-foreground">
              No documents match your search criteria.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Document Details Dialog */}
      <Dialog
        open={!!selectedDocument}
        onOpenChange={() => setSelectedDocument(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedDocument && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">
                      {selectedDocument.name}
                    </DialogTitle>
                    <Badge
                      className={`mt-2 ${getCategoryColor(
                        selectedDocument.category
                      )}`}
                      variant="outline"
                    >
                      {selectedDocument.category}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Document Info */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Shared by:</span>
                    <span className="text-muted-foreground">
                      {selectedDocument.uploadedBy}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Date:</span>
                    <span className="text-muted-foreground">
                      {format(
                        selectedDocument.uploadedAt,
                        "MMMM d, yyyy 'at' h:mm a"
                      )}
                    </span>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">
                    Message from Admin
                  </h4>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <p className="text-sm text-foreground leading-relaxed">
                      {selectedDocument.message}
                    </p>
                  </div>
                </div>

                {/* View PDF Button */}
                <Button className="w-full">
                  <Eye className="h-4 w-4 mr-2" />
                  Open PDF Document
                </Button>

                {/* Comments Section */}
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Comments ({selectedDocument.comments.length})
                  </h4>

                  {/* Existing Comments */}
                  <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                    {selectedDocument.comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No comments yet. Be the first to leave feedback!
                      </p>
                    ) : (
                      selectedDocument.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="bg-muted/30 rounded-lg p-3 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {comment.author}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(comment.createdAt, "MMM d, yyyy")}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {comment.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Comment */}
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Write a comment or feedback..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="w-full"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Comment
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberDocuments;
