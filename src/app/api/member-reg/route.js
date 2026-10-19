import User from "@/app/models/User";
import connect from "@/app/utils/db";
import { NextResponse } from "next/server";

export async function POST(request) {
  console.log("API Route called: /api/member-reg");

  try {
    // Get the request body
    const data = await request.json();
    console.log("Received data:", data);

    // Validate required fields
    if (!data.firstName || !data.lastName || !data.email || !data.idNumber) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: "First name, last name, email, and ID number are required",
        },
        { status: 400 }
      );
    }

    // Connect to database
    await connect();
    console.log("Database connected");

    // Check if member exists
    const existingMember = await User.findOne({
      $or: [{ idnumber: data.idNumber }, { email: data.email }],
    });

    if (existingMember) {
      console.log("Member already exists");
      return NextResponse.json(
        { error: "Member already exists with this ID or email" },
        { status: 409 }
      );
    }

    // Create new member
    const fullName = `${data.firstName} ${data.lastName}`.trim();

    const newMember = new User({
      name: fullName,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      idnumber: data.idNumber,
      dateofbirth: data.dateOfBirth,
      gender: data.gender,
      address: data.address,
      city: data.city,
      county: data.county,
      graduationYear: data.graduationYear,
      specialization: data.specialization,
      occupation: data.occupation,
      currentEmployer: data.currentEmployer,
      membershipCategory: data.membershipCategory || "associate",
      password: data.password, // In production, hash this!
      accountStatus: "active",
      registeredByAdmin: true,
      registrationDate: new Date(),
      createdAt: new Date(),
    });

    // Save to database
    const savedMember = await newMember.save();
    console.log("Member saved:", savedMember._id);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Member registered successfully",
        memberId: savedMember._id,
        member: {
          name: savedMember.name,
          email: savedMember.email,
          idnumber: savedMember.idnumber,
          membershipCategory: savedMember.membershipCategory,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in member registration:", error);

    // Handle specific errors
    if (error.name === "ValidationError") {
      return NextResponse.json(
        { error: "Validation error", details: error.message },
        { status: 400 }
      );
    }

    if (error.code === 11000) {
      return NextResponse.json(
        { error: "Duplicate key error - Member may already exist" },
        { status: 409 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: "Failed to register member",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

// Optional: Add GET method to test the route
export async function GET() {
  return NextResponse.json(
    {
      message: "Member registration API is working",
      endpoint: "POST /api/member-reg to register a new member",
    },
    { status: 200 }
  );
}
