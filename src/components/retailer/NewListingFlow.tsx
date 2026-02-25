
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import React, { useEffect, useState, useMemo } from "react";
import { useForm, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { doc, collection, writeBatch, serverTimestamp } from "firebase/firestore";
import { Loader2, Gem, Wine, Palette, ShoppingBag, CreditCard, Phone, Shirt, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addDays, addMinutes, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AuctionSettingsForm } from "@/components/retailer/AuctionSettingsForm";
import { ImageUploader } from "@/components/retailer/ImageUploader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LebanesePlateDisplay } from "@/components/auctions/lebanese-plate-display";
import Link from "next/link";

// Common Schemas
const auctionSettingsSchema = {
  startingBid: z.coerce.number().positive({ message: "Starting bid must be a positive number." }),
  minimumBidIncrement: z.coerce.number().nonnegative({ message: "Minimum bid increment must be non-negative." }),
  startOption: z.enum(['now', 'schedule', 'flash']).default('now'),
  auctionStartDate: z.date().optional(),
  auctionStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:MM)." }).optional(),
  auctionDuration: z.coerce.number().int().min(1, {message: "Duration must be at least 1 day."}).max(7, {message: "Duration cannot exceed 7 days."}),
  flashDuration: z.coerce.number().optional(),
};

const imageSchema = {
    imageUrls: z.array(z.object({ value: z.string().min(1, { message: "An image is required." }) })).min(1, "Please provide at least one image.").max(4, "You can upload a maximum of 4 images."),
};

const formRefine = (data: any, ctx: z.RefinementCtx) => {
    if (data.startOption === 'schedule') {
        if (!data.auctionStartDate) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A start date is required for a scheduled auction.", path: ["auctionStartDate"] });
        }
        if (!data.auctionStartTime) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A start time is required for a scheduled auction.", path: ["auctionStartTime"] });
        }
        if (data.auctionStartDate && data.auctionStartTime) {
            const [startHours, startMinutes] = data.auctionStartTime.split(':').map(Number);
            const startDateTime = new Date(data.auctionStartDate);
            startDateTime.setHours(startHours, startMinutes, 0, 0);

            if (startDateTime < new Date()) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Scheduled auction start cannot be in the past.", path: ["auctionStartDate"] });
            }
        }
    }
    if (data.startOption === 'flash') {
        if (!data.flashDuration) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please select a duration for the flash auction.", path: ["flashDuration"] });
        }
    }
};

// Form Schemas
const iconicSchema = z.object({
  itemName: z.string().min(3, { message: "Item name must be at least 3 characters long." }).max(20, { message: "Title cannot be longer than 20 characters." }),
  category: z.string().min(3, { message: "Celebrity name must be at least 3 characters long." }),
  description: z.string().min(10, { message: "Please provide a more detailed description." }),
  ...imageSchema,
  ...auctionSettingsSchema,
}).superRefine(formRefine);

const otherSchema = z.object({
  itemName: z.string().min(3, { message: "Item name must be at least 3 characters long." }).max(20, { message: "Title cannot be longer than 20 characters." }),
  description: z.string().min(10, { message: "Please provide a more detailed description." }),
  ...imageSchema,
  ...auctionSettingsSchema,
}).superRefine(formRefine);

const alcoholSchema = z.object({
  name: z.string().min(3, { message: "Bottle name must be at least 3 characters long." }).max(20, { message: "Title cannot be longer than 20 characters." }),
  subcategory: z.enum(["Whiskey", "Wine", "Rum", "Tequila", "Gin", "Vodka", "Liqueur", "Other"], { required_error: "Please select a sub-category." }),
  age: z.coerce.number().int({message: "Age must be a whole number."}).nonnegative({ message: "Age cannot be negative." }),
  description: z.string().min(10, { message: "Please provide a more detailed description." }),
  ...imageSchema,
  ...auctionSettingsSchema,
}).superRefine(formRefine);

const artSchema = z.object({
  itemName: z.string().min(3, { message: "Item name must be at least 3 characters long." }).max(20, { message: "Title cannot be longer than 20 characters." }),
  category: z.string().min(2, { message: "Artist name must be at least 2 characters long." }),
  subcategory: z.enum(["Painting", "Sculpture", "Photography", "Print", "Drawing", "Digital Art", "Other"], { required_error: "Please select a sub-category." }),
  description: z.string().min(10, { message: "Please provide a more detailed story." }),
  ...imageSchema,
  ...auctionSettingsSchema,
}).superRefine(formRefine);

const plateSchema = z.object({
  plateLetter: z.string().length(1, "Must be a single letter.").regex(/^[A-Z]$/i, "Must be a letter."),
  plateDigits: z.string().min(1, "Number is required.").max(7, "Number can be up to 7 digits.").regex(/^\d+$/, "Must be digits."),
  category: z.string().min(2, { message: "Region must be at least 2 characters long." }),
  ...auctionSettingsSchema,
}).transform(data => ({
    ...data,
    itemName: `${data.plateLetter.toUpperCase()} ${data.plateDigits}`
})).superRefine(formRefine);

const phoneNumberSchema = z.object({
  itemName: z.string().min(5, { message: "Phone number must be at least 5 characters long." }).max(20, { message: "Phone number cannot be longer than 20 characters." }),
  category: z.string().min(2, { message: "Provider / Country must be at least 2 characters long." }),
  ...auctionSettingsSchema,
}).superRefine(formRefine);

const apparelSchema = z.object({
  itemName: z.string().min(3, { message: "Item name must be at least 3 characters long." }).max(20, { message: "Title cannot be longer than 20 characters." }),
  category: z.enum(["Tops", "Bottoms", "Outerwear", "Dresses", "Shoes", "Accessories"], { required_error: "Please select a sub-category." }),
  description: z.string().min(10, { message: "Please provide a more detailed description." }),
  ...imageSchema,
  ...auctionSettingsSchema,
}).superRefine(formRefine);

// Category Specific Form Fields
const IconicFormFields = () => (
    <>
        <FormField name="itemName" render={({ field }) => ( <FormItem> <FormLabel>Item Name</FormLabel> <FormControl><Input placeholder="e.g., Signed Movie Script" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField name="category" render={({ field }) => ( <FormItem> <FormLabel>Celebrity Name</FormLabel> <FormControl><Input placeholder="e.g., Tom Hanks" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField name="description" render={({ field }) => ( <FormItem> <FormLabel>Description</FormLabel> <FormControl><Textarea placeholder="A detailed description of the item, its history, and its connection to the celebrity." {...field} /></FormControl> <FormMessage /> </FormItem> )} />
    </>
);
const OtherFormFields = () => (
     <>
        <FormField name="itemName" render={({ field }) => ( <FormItem> <FormLabel>Item Name</FormLabel> <FormControl><Input placeholder="e.g., Vintage Leather Jacket" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField name="description" render={({ field }) => ( <FormItem> <FormLabel>Description</FormLabel> <FormControl><Textarea placeholder="A detailed description of the item and its condition." {...field} /></FormControl> <FormMessage /> </FormItem> )} />
    </>
);
const AlcoholFormFields = () => (
    <>
        <FormField name="name" render={({ field }) => ( <FormItem> <FormLabel>Bottle Name</FormLabel> <FormControl><Input placeholder="e.g., Glen-Silent Stills 25 Year" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField
            control={useFormContext().control}
            name="subcategory"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Sub-category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a sub-category" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Whiskey">Whiskey</SelectItem>
                            <SelectItem value="Wine">Wine</SelectItem>
                            <SelectItem value="Rum">Rum</SelectItem>
                            <SelectItem value="Tequila">Tequila</SelectItem>
                            <SelectItem value="Gin">Gin</SelectItem>
                            <SelectItem value="Vodka">Vodka</SelectItem>
                            <SelectItem value="Liqueur">Liqueur</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormField name="age" render={({ field }) => ( <FormItem> <FormLabel>Age</FormLabel> <FormControl><Input type="number" placeholder="e.g., 25 (in years), or 0 for no age statement" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField name="description" render={({ field }) => ( <FormItem> <FormLabel>Description</FormLabel> <FormControl><Textarea placeholder="A detailed description of the item, its history, and tasting notes." {...field} /></FormControl> <FormMessage /> </FormItem> )} />
    </>
);
const ArtFormFields = () => (
    <>
        <FormField name="itemName" render={({ field }) => ( <FormItem> <FormLabel>Title of Artwork</FormLabel> <FormControl><Input placeholder="e.g., Starry Night" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField name="category" render={({ field }) => ( <FormItem> <FormLabel>Artist Name</FormLabel> <FormControl><Input placeholder="e.g., Vincent van Gogh" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField
            control={useFormContext().control}
            name="subcategory"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Type of Art</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Painting">Painting</SelectItem>
                            <SelectItem value="Sculpture">Sculpture</SelectItem>
                            <SelectItem value="Photography">Photography</SelectItem>
                            <SelectItem value="Print">Print</SelectItem>
                            <SelectItem value="Drawing">Drawing</SelectItem>
                            <SelectItem value="Digital Art">Digital Art</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormField name="description" render={({ field }) => ( <FormItem> <FormLabel>Story</FormLabel> <FormControl><Textarea placeholder="A detailed story behind the artwork, its meaning, and history." {...field} /></FormControl> <FormMessage /> </FormItem> )} />
    </>
);

const LebanesePlatePreview = () => {
    const { watch } = useFormContext();
    const plateLetter = watch('plateLetter');
    const plateDigits = watch('plateDigits');
    const plateNumber = (plateLetter || plateDigits) ? `${(plateLetter || '').toUpperCase()}${(plateLetter && plateDigits) ? ' ' : ''}${plateDigits || ''}`.trim() : 'B 123456';

    return (
        <div className="mt-4">
            <FormLabel>Plate Preview</FormLabel>
            <div className="mt-2">
                <LebanesePlateDisplay plateNumber={plateNumber} size="small" />
            </div>
        </div>
    );
};


const PlateFormFields = () => (
    <>
        <FormItem>
            <FormLabel>Plate Number</FormLabel>
            <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                <FormField
                    control={useFormContext().control}
                    name="plateLetter"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Input placeholder="B" {...field} maxLength={1} className="w-16 text-center uppercase" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={useFormContext().control}
                    name="plateDigits"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Input placeholder="123456" {...field} maxLength={7} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            <FormDescription>Enter the letter and numbers for the plate.</FormDescription>
        </FormItem>
        <FormField name="category" render={({ field }) => ( <FormItem> <FormLabel>Region / Country</FormLabel> <FormControl><Input placeholder="e.g., Lebanon" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <LebanesePlatePreview />
    </>
);
const PhoneNumberFormFields = () => (
    <>
        <FormField name="itemName" render={({ field }) => ( <FormItem> <FormLabel>Phone Number</FormLabel> <FormControl><Input placeholder="e.g., 555-555-5555" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField name="category" render={({ field }) => ( <FormItem> <FormLabel>Provider / Country</FormLabel> <FormControl><Input placeholder="e.g., Verizon" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
    </>
);

const ApparelFormFields = () => (
    <>
        <FormField name="itemName" render={({ field }) => ( <FormItem> <FormLabel>Item Name</FormLabel> <FormControl><Input placeholder="e.g., Designer Sneakers" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
        <FormField
            control={useFormContext().control}
            name="category"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Sub-category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a sub-category" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Tops">Tops</SelectItem>
                            <SelectItem value="Bottoms">Bottoms</SelectItem>
                            <SelectItem value="Outerwear">Outerwear</SelectItem>
                            <SelectItem value="Dresses">Dresses</SelectItem>
                            <SelectItem value="Shoes">Shoes</SelectItem>
                            <SelectItem value="Accessories">Accessories</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormField name="description" render={({ field }) => ( <FormItem> <FormLabel>Description</FormLabel> <FormControl><Textarea placeholder="A detailed description of the item, its condition, brand, size, etc." {...field} /></FormControl> <FormMessage /> </FormItem> )} />
    </>
);

const categories = [
    { value: 'iconic', label: 'Iconic Item', icon: Gem, schema: iconicSchema, collection: 'iconics', fields: <IconicFormFields />, success: (v: any) => ({title: "Iconic Item Listed!", description: `${v.itemName} has been successfully listed.`}), defaultValues: { itemName: '', category: '', description: '' } },
    { value: 'other', label: 'Other', icon: ShoppingBag, schema: otherSchema, collection: 'others', fields: <OtherFormFields />, success: (v: any) => ({title: "Item Listed!", description: `${v.itemName} has been successfully listed.`}), defaultValues: { itemName: '', description: '' } },
    { value: 'alcohol', label: 'Alcohol', icon: Wine, schema: alcoholSchema, collection: 'alcohol', fields: <AlcoholFormFields />, success: (v: any) => ({title: "Alcohol Item Listed!", description: `${v.name} has been successfully listed.`}), defaultValues: { name: '', subcategory: undefined, age: 0, description: '' } },
    { value: 'art', label: 'Art', icon: Palette, schema: artSchema, collection: 'art', fields: <ArtFormFields />, success: (v: any) => ({title: "Art Piece Listed!", description: `${v.itemName} has been successfully listed.`}), defaultValues: { itemName: '', category: '', subcategory: undefined, description: '' } },
    { value: 'apparel', label: 'Apparel', icon: Shirt, schema: apparelSchema, collection: 'apparels', fields: <ApparelFormFields />, success: (v: any) => ({title: "Apparel Listed!", description: `${v.itemName} has been successfully listed.`}), defaultValues: { itemName: '', category: undefined, description: '' } },
    { value: 'plate', label: 'Car Plate', icon: CreditCard, schema: plateSchema, collection: 'plates', fields: <PlateFormFields />, success: (v: any) => ({title: "Plate Listed!", description: `Plate ${v.itemName} has been successfully listed.`}), defaultValues: { plateLetter: '', plateDigits: '', category: '' } },
    { value: 'phoneNumber', label: 'Phone Number', icon: Phone, schema: phoneNumberSchema, collection: 'phoneNumbers', fields: <PhoneNumberFormFields />, success: (v:any) => ({title: "Phone Number Listed!", description: `Number ${v.itemName} has been successfully listed.`}), defaultValues: { itemName: '', category: '' } },
];


// Generic Form Component
interface ListingFormProps<T extends z.ZodType<any, any>> {
  schema: T;
  collectionName: string;
  successToast: (values: z.infer<T>) => { title: string; description: string };
  children: React.ReactNode;
  userProfile: any;
  defaultValues: Partial<z.infer<T>>;
  onSuccess: () => void;
}

function ListingForm<T extends z.ZodType<any, any>>({ schema, collectionName, successToast, children, userProfile, defaultValues, onSuccess }: ListingFormProps<T>) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...defaultValues,
      startingBid: '',
      minimumBidIncrement: 0,
      startOption: "now",
      auctionDuration: 1,
      auctionStartDate: undefined,
      auctionStartTime: "12:00",
      flashDuration: undefined,
      imageUrls: [],
    },
  });

  const onSubmit = async (values: z.infer<T>) => {
    if (!firestore || !user) return;
    setIsSubmitting(true);
    
    const hasUnlimitedListings = userProfile?.isPlusUser || userProfile?.isUltimateUser;

    if (!hasUnlimitedListings && userProfile?.lastListingTimestamp) {
        const lastListingDate = userProfile.lastListingTimestamp.toDate();
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        if (lastListingDate > fourteenDaysAgo) {
            const nextAvailableDate = addDays(lastListingDate, 14);
            toast({
                variant: "destructive",
                title: "Listing Limit Reached",
                description: `You can post one auction every 14 days. You can post again on ${format(nextAvailableDate, 'PP')}.`,
            });
            setIsSubmitting(false);
            return;
        }
    }


    let startDateTime: Date;
    let endDateTime: Date;
    const isFlash = values.startOption === 'flash';

    if (values.startOption === 'schedule') {
        startDateTime = new Date(values.auctionStartDate!);
        const [startHours, startMinutes] = values.auctionStartTime!.split(':').map(Number);
        startDateTime.setHours(startHours, startMinutes, 0, 0);
        endDateTime = addDays(startDateTime, values.auctionDuration);
    } else { // 'now' or 'flash'
        startDateTime = new Date();
        if (isFlash) {
            endDateTime = addMinutes(startDateTime, values.flashDuration!);
        } else { // 'now'
            endDateTime = addDays(startDateTime, values.auctionDuration);
        }
    }
    
    const status = values.startOption === 'schedule' ? 'upcoming' : 'live';

    try {
      const batch = writeBatch(firestore);
      const newListingRef = doc(collection(firestore, collectionName));
      
      const {
        startOption,
        auctionStartDate: formStartDate,
        auctionStartTime,
        auctionDuration,
        flashDuration,
        plateLetter,
        plateDigits,
        ...dbValues
      } = values;

      const listingData: any = {
        ...dbValues,
        userId: user.uid,
        currentBid: values.startingBid,
        bidCount: 0,
        auctionStartDate: startDateTime.toISOString(),
        auctionEndDate: endDateTime.toISOString(),
        status: status,
        isFlashAuction: isFlash,
        isPromoted: false,
      };

      if (values.imageUrls) {
        listingData.imageUrls = values.imageUrls.map((urlObj: {value: string}) => urlObj.value)
      }
      
      batch.set(newListingRef, listingData);
      
      const userDocRef = doc(firestore, 'users', user.uid);
      batch.set(userDocRef, { lastListingTimestamp: serverTimestamp() }, { merge: true });

      await batch.commit();
      
      toast({ variant: 'success', ...successToast(values) });
      onSuccess();

    } catch (error) {
      console.error("Failed to list item:", error);
       toast({
        variant: "destructive",
        title: "Listing Failed",
        description: "Could not create the auction listing. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-6">
            <div className="grid md:grid-cols-2 md:gap-x-8 gap-y-8">
                <div className="space-y-8">
                    {children}
                </div>
                 <div className="space-y-8">
                    {collectionName !== 'plates' && collectionName !== 'phoneNumbers' && <ImageUploader name="imageUrls" />}
                    <AuctionSettingsForm form={form} />
                </div>
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Listing Item...' : 'List Item for Auction'}
            </Button>
        </form>
    </Form>
  )
}

interface NewListingFlowProps {
  initialCategory?: string;
  onSuccess: () => void;
}

export function NewListingFlow({ initialCategory, onSuccess }: NewListingFlowProps) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [selectedCategory, setSelectedCategory] = useState<string>('');

    const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile, isLoading: isUserProfileLoading } = useDoc(userProfileRef);

    useEffect(() => {
        const categoryToSelect = categories.find(c => c.collection === initialCategory);
        if (categoryToSelect) {
            setSelectedCategory(categoryToSelect.value);
        } else {
            setSelectedCategory('');
        }
    }, [initialCategory]);
    
    const selectedCategoryData = useMemo(() => categories.find(c => c.value === selectedCategory), [selectedCategory]);
    const hasUnlimitedListings = userProfile?.isPlusUser || userProfile?.isUltimateUser;

    if (isUserLoading || isUserProfileLoading) {
        return (
            <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
             {!hasUnlimitedListings && (
              <div className="p-4 rounded-lg bg-info text-info-foreground">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 shrink-0 mt-0.5 text-info-emphasis" />
                          <div>
                              <p className="font-semibold text-base">Listing Limit for Basic Accounts</p>
                              <p className="text-sm opacity-90">You can only publish one listing per 14 days. To get unlimited listings, please upgrade to a <b className="font-semibold">Plus or Ultimate subscription</b>.</p>
                          </div>
                      </div>
                      <Button asChild size="sm" className="bg-info-emphasis text-info-emphasis-foreground hover:bg-info-emphasis/90 focus-visible:ring-info-emphasis w-full sm:w-auto shrink-0">
                          <Link href="/profile/subscription">
                              Upgrade Subscription
                          </Link>
                      </Button>
                  </div>
              </div>
            )}
            <Select onValueChange={setSelectedCategory} value={selectedCategory}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a category..." />
                </SelectTrigger>
                <SelectContent>
                    {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                                <cat.icon className="h-4 w-4" />
                                <span>{cat.label}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {selectedCategoryData && (
                <div className="mt-6 border-t pt-6 animate-in fade-in-50">
                     <ListingForm
                        userProfile={userProfile}
                        schema={selectedCategoryData.schema}
                        collectionName={selectedCategoryData.collection}
                        successToast={selectedCategoryData.success}
                        defaultValues={selectedCategoryData.defaultValues}
                        onSuccess={onSuccess}
                    >
                        {selectedCategoryData.fields}
                    </ListingForm>
                </div>
            )}
        </div>
    );
}
