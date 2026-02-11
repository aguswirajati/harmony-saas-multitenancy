'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

export default function NotFoundClient() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="text-9xl font-bold text-gray-200">404</div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Page Not Found
          </CardTitle>
          <CardDescription>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>What can you do?</strong>
            </p>
            <ul className="list-disc list-inside text-sm text-blue-800 mt-2 space-y-1">
              <li>Check the URL for typos</li>
              <li>Go back to the previous page</li>
              <li>Start from the home page</li>
              <li>Use the search feature to find what you need</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Link href="/" className="w-full sm:w-auto">
            <Button className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Go to Home
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
