
'use client';

import { useEffect } from 'react';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Zap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from '../ui/switch';

type AuctionSettingsFormProps = {
    form: any;
}

export function AuctionSettingsForm({ form }: AuctionSettingsFormProps) {
    const startOption = form.watch('startOption');
    const startingBid = form.watch('startingBid');

    useEffect(() => {
        if (startingBid > 0) {
            const calculatedIncrement = Math.max(1, Math.round(startingBid * 0.01));
            form.setValue('minimumBidIncrement', calculatedIncrement, { shouldValidate: true });
        } else {
            form.setValue('minimumBidIncrement', 0, { shouldValidate: true });
        }
    }, [startingBid, form]);

    return (
        <>
            <Card className="bg-secondary/50">
                <CardHeader>
                    <p className="font-medium">Auction Pricing</p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <FormField
                        control={form.control}
                        name="startingBid"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Starting Bid ($)</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="e.g. 100" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="minimumBidIncrement"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Minimum Bid Increment ($)</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="Auto-calculated" {...field} readOnly className="bg-muted/50" />
                            </FormControl>
                            <FormDescription>
                                Auto-calculated as 1% of starting bid.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </CardContent>
            </Card>

            <FormField
                control={form.control}
                name="startOption"
                render={({ field }) => (
                <FormItem className="space-y-3">
                    <FormLabel>Auction Start</FormLabel>
                    <FormControl>
                    <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
                    >
                        <div className="flex items-center gap-2">
                        <RadioGroupItem value="now" id="now-option" />
                        <Label htmlFor="now-option">Start now</Label>
                        </div>
                        <div className="flex items-center gap-2">
                        <RadioGroupItem value="schedule" id="schedule-option" />
                        <Label htmlFor="schedule-option">Schedule for Later</Label>
                        </div>
                        <div className="flex items-center gap-2 font-semibold text-accent-darker">
                        <RadioGroupItem value="flash" id="flash-option" className="border-accent text-accent ring-offset-background focus-visible:ring-accent" />
                        <Label htmlFor="flash-option" className="flex items-center gap-1.5">
                            <Zap className="w-4 h-4" />
                            AuctionPrime Flash
                        </Label>
                        </div>
                    </RadioGroup>
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />

            {startOption === 'schedule' && (
                <div className="space-y-2 rounded-lg border p-4 animate-in fade-in-50">
                    <p className="text-sm font-medium">Schedule Auction Start</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <FormField
                        control={form.control}
                        name="auctionStartDate"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Start Date</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value ? (
                                        format(field.value, "PPP")
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) =>
                                        date < new Date(new Date().setDate(new Date().getDate() - 1)) // Allow today
                                    }
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                            control={form.control}
                            name="auctionStartTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-muted-foreground">Start Time</FormLabel>
                                    <FormControl>
                                        <Input type="time" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            )}

            {startOption === 'flash' && (
                <div className="space-y-2 rounded-lg border border-accent/50 bg-accent/10 p-4 animate-in fade-in-50">
                    <p className="text-sm font-medium text-accent-darker">Flash Auction Duration</p>
                     <FormField
                        control={form.control}
                        name="flashDuration"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">Duration</FormLabel>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a short duration" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="15">15 minutes</SelectItem>
                                    <SelectItem value="30">30 minutes</SelectItem>
                                    <SelectItem value="45">45 minutes</SelectItem>
                                    <SelectItem value="60">1 hour</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormDescription>
                                This auction will go live immediately and end after the selected duration.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            )}

            {startOption !== 'flash' && (
                <FormField
                    control={form.control}
                    name="auctionDuration"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Auction Duration</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {[...Array(7)].map((_, i) => {
                                const day = i + 1;
                                return (
                                <SelectItem key={day} value={day.toString()}>
                                    {day} Day{day > 1 ? 's' : ''}
                                </SelectItem>
                                )
                            })}
                            </SelectContent>
                        </Select>
                        <FormDescription>
                            The auction will end at the same time it starts, after the selected number of days.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}
        </>
    )
}
