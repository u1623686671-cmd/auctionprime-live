
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gavel, User, CreditCard, KeyRound, LifeBuoy, LogOut, Package, Shield, ChevronRight, FileText, Info, Coins, PlusCircle, AlertTriangle, Loader2, Upload } from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from "firebase/firestore";
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Loading from './loading';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import heic2any from "heic2any";


const accountNavItems = [
    {
        icon: Shield,
        title: "Subscription",
        href: "/profile/subscription"
    },
    {
        icon: CreditCard,
        title: "Billing",
        href: "/profile/billing"
    },
    {
        icon: KeyRound,
        title: "Password",
        href: "/profile/password"
    },
    {
        icon: LifeBuoy,
        title: "Help & Support",
        href: "/help"
    },
    {
        icon: AlertTriangle,
        title: "Delete Account",
        href: "/profile/delete-account"
    },
];

const legalNavItems = [
    {
        icon: Info,
        title: "About",
        href: "/about"
    },
    {
        icon: FileText,
        title: "Privacy Policy",
        href: "/privacy"
    },
    {
        icon: FileText,
        title: "Terms of Service",
        href: "/terms"
    },
];

// Helper function to resize the image
const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) {
        return reject(new Error("FileReader did not produce a result."));
      }
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG with quality 0.8
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
      img.src = event.target.result as string;
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export default function ProfilePage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const auth = useAuth();
    const router = useRouter();
    const isMobile = useIsMobile();
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);

    const adminRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'admins', user.uid);
      }, [firestore, user]);
      const { data: admin, isLoading: isAdminLoading } = useDoc(adminRef);
    
      const supportRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'support', user.uid);
      }, [firestore, user]);
      const { data: supportUser, isLoading: isSupportLoading } = useDoc(supportRef);
    
      const userProfileRef = useMemoFirebase(() => {
          if (!firestore || !user) return null;
          return doc(firestore, 'users', user.uid);
      }, [firestore, user]);
      const { data: userProfile, isLoading: isUserProfileLoading } = useDoc(userProfileRef);

      const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        if (!user || !auth.currentUser || !userProfileRef) return;

        const file = acceptedFiles[0];
        setIsUploading(true);

        try {
            let fileToProcess = file;
            const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);

            if (isHeic) {
                toast({ title: 'Converting HEIC image...', description: 'This may take a moment.' });
                const heic2any = (await import('heic2any')).default;
                const conversionResult = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
                const convertedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
                if (!convertedBlob) throw new Error("HEIC conversion failed.");
                const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpeg');
                fileToProcess = new File([convertedBlob], newFileName, { type: 'image/jpeg' });
            }

            const resizedDataUrl = await resizeImage(fileToProcess, 256, 256);

            await updateProfile(auth.currentUser, { photoURL: resizedDataUrl });
            await updateDoc(userProfileRef, { photoURL: resizedDataUrl });

            toast({
                variant: 'success',
                title: 'Profile Photo Updated!',
            });

        } catch (error) {
            console.error("Profile photo upload error:", error);
            toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: 'Could not update your profile photo. Please try again with a different image.',
            });
        } finally {
            setIsUploading(false);
        }
    }, [user, auth, userProfileRef, toast]);

    const { getRootProps, getInputProps } = useDropzone({
        onDrop,
        accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp', '.heic', '.heif'] },
        multiple: false,
        maxSize: 10 * 1024 * 1024, // 10MB
        onDropRejected: (fileRejections) => {
            fileRejections.forEach(({ file, errors }) => {
                errors.forEach(error => {
                    if (error.code === 'file-too-large') {
                        toast({ variant: 'destructive', title: `File too large: ${file.name}`, description: 'Please upload images under 10MB.' });
                    } else if (error.code === 'file-invalid-type') {
                        toast({ variant: 'destructive', title: `Invalid file type: ${file.name}`, description: 'Please upload a valid image file (jpeg, png, heic, etc.).' });
                    } else {
                        toast({ variant: 'destructive', title: `Error with ${file.name}`, description: error.message });
                    }
                });
            });
        },
    });


      const getInitials = (name: string) => {
        if (!name) return 'U';
        const names = name.split(' ');
        if (names.length > 1 && names[0] && names[names.length - 1]) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return name ? name.substring(0, 2).toUpperCase() : 'U';
      }

      const handleLogout = () => {
        signOut(auth);
        router.push('/login');
      };

    if (isUserLoading || !user || isAdminLoading || isSupportLoading || isUserProfileLoading) {
        return <Loading />;
    }
    
    const isProfilePage = true;


    return (
        <div className="container mx-auto max-w-2xl px-4 py-12 md:py-16">
             {isMobile && !isProfilePage && (
              <div className="fixed top-0 left-0 right-0 z-30 bg-card border-b h-16 flex items-center justify-end px-4">
              </div>
            )}
            <header className="mb-12">
                <h1 className="text-4xl md:text-5xl font-bold font-headline mb-2">
                    Profile
                </h1>
                <p className="text-lg text-muted-foreground">
                    Manage your account settings and view your activity.
                </p>
            </header>
            <div className="space-y-8">
                <Card className="overflow-hidden shadow-lg border-0">
                    <div className="h-24 bg-gradient-to-r from-primary to-accent" />
                    <div className="relative p-6 pt-0">
                        <div className="flex justify-center -mt-12">
                            <div {...getRootProps()} className="relative w-24 h-24 rounded-full cursor-pointer group">
                                <input {...getInputProps()} />
                                <Avatar className="w-24 h-24 border-4 border-background">
                                    {(userProfile?.photoURL || user.photoURL) && <AvatarImage src={userProfile?.photoURL || user.photoURL!} data-ai-hint="person face" />}
                                    <AvatarFallback className="text-3xl">{user.displayName ? getInitials(user.displayName) : 'U'}</AvatarFallback>
                                </Avatar>
                                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isUploading ? (
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                    ) : (
                                        <div className="text-center">
                                            <Upload className="w-6 h-6 mx-auto" />
                                            <p className="text-xs font-semibold mt-1">Change</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-center mt-4">
                            <div className="flex items-center justify-center gap-2">
                                <h2 className="text-xl font-semibold">{user.displayName || "User"}</h2>
                                {userProfile?.isUltimateUser ? (
                                <Badge className="bg-purple-500 text-white hover:bg-purple-500">ULTIMATE</Badge>
                                ) : userProfile?.isPlusUser && (
                                <Badge className="bg-sky-500 text-white hover:bg-sky-500">PLUS</Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                         <div className="mt-6 flex flex-col sm:flex-row gap-2">
                             <Button asChild variant="outline" className="w-full">
                                <Link href="/profile/account-details">
                                    <User className="mr-2 h-4 w-4"/>
                                    Edit Profile
                                </Link>
                            </Button>
                            <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                                <LogOut className="mr-2 h-4 w-4"/>
                                Logout
                            </Button>
                        </div>
                    </div>
                </Card>

                {admin && (
                    <div className="flex items-center justify-between p-4 rounded-lg bg-accent/10 border border-accent/50">
                        <div className="flex items-center gap-3 text-accent-darker">
                            <Shield className="h-5 w-5" />
                            <p className="font-semibold">Admin Access</p>
                        </div>
                        <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent">
                            <Link href="/admin/dashboard">
                                Go to Dashboard
                            </Link>
                        </Button>
                    </div>
                )}
                {supportUser && !admin && (
                    <div className="flex items-center justify-between p-4 rounded-lg bg-accent/10 border border-accent/50">
                         <div className="flex items-center gap-3 text-accent-darker">
                            <LifeBuoy className="h-5 w-5" />
                            <p className="font-semibold">Support Agent Access</p>
                        </div>
                        <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:ring-accent">
                            <Link href="/support/dashboard">
                                Go to Dashboard
                            </Link>
                        </Button>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Link href="/my-bids">
                         <Card className="shadow-lg border-0 hover:bg-muted/50 transition-all duration-300 group h-full">
                           <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                                <Gavel className="w-8 h-8 text-primary mb-4"/>
                                <p className="font-semibold text-lg">My Bids</p>
                            </CardContent>
                        </Card>
                    </Link>
                    <Link href="/retailer/dashboard">
                         <Card className="shadow-lg border-0 hover:bg-muted/50 transition-all duration-300 group h-full">
                             <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                                <Package className="w-8 h-8 text-primary mb-4"/>
                                <p className="font-semibold text-lg">My Listings</p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-4 mt-8">Account Settings</h3>
                    <div>
                        {accountNavItems.map((item) => (
                            <Link href={item.href} key={item.title} className="block group">
                                <div className="flex items-center justify-between p-4 bg-transparent group-hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <item.icon className="w-5 h-5 text-primary"/>
                                        <p className="font-semibold">{item.title}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-4 mt-8">Legal</h3>
                    <div>
                        {legalNavItems.map((item) => (
                            <Link href={item.href} key={item.title} className="block group">
                                <div className="flex items-center justify-between p-4 bg-transparent group-hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <item.icon className="w-5 h-5 text-primary"/>
                                        <p className="font-semibold">{item.title}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    
}
