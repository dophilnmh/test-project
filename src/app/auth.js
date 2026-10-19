import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import connect from './utils/db';
import User from './models/User';
import Organizer from './models/Organizer';

const SESSION_MAX_AGE = 30 * 60;

export const { auth, handlers } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,

  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
  },

  jwt: {
    maxAge: SESSION_MAX_AGE,
  },

  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        await connect();

        const user = await User.findOne({ email: credentials.email });
        if (user) {
          const isValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isValid) return null;

          if (String(user.status || '').toLowerCase() === 'suspended') {
            return null;
          }

          return {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            name: user.name,
            status: user.status,
            membershipNumber: user.membershipNumber,
          };
        }

        const organizer = await Organizer.findOne({
          email: credentials.email,
        });
        if (!organizer) return null;

        const organizerValid = await bcrypt.compare(
          credentials.password,
          organizer.password
        );

        if (!organizerValid) return null;

        return {
          id: organizer._id.toString(),
          email: organizer.email,
          role: 'organizer',
          name: organizer.organizationName,
          status: organizer.status,
          membershipNumber: null,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // ✅ Transfer all user properties to token
        token.role = user.role;
        token.name = user.name;
        token.id = user.id;
        token.email = user.email;
        token.status = user.status;
        token.membershipNumber = user.membershipNumber;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        // ✅ Transfer all token properties to session
        session.user.role = token.role;
        session.user.name = token.name;
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.status = token.status;
        session.user.membershipNumber = token.membershipNumber;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
  },
});
