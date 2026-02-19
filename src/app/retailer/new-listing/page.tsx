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
import { NewListingFlow as OriginalNewListingFlow } from "@/components/retailer/NewListingFlow"; // Renamed to avoid conflict

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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

export { NewListingFlow as default };
