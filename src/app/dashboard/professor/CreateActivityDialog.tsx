"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label, Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronDownIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface CreateActivityDialogProps {
  classId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onActivityCreated: () => void;
}

interface DateTimePickerProps {
  label: string;
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  time: string;
  setTime: React.Dispatch<React.SetStateAction<string>>;
}

export function CreateActivityDialog({
  classId,
  isOpen,
  onOpenChange,
  onActivityCreated,
}: CreateActivityDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("10:00");
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(
    new Date(new Date().setDate(new Date().getDate() + 7))
  );
  const [deadlineTime, setDeadlineTime] = useState("23:59");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };

  const combineDateTime = (date: Date | undefined, time: string) => {
    if (!date) return "";
    const [hours, minutes] = time.split(":");
    const combined = new Date(date);
    combined.setHours(parseInt(hours), parseInt(minutes));
    return combined.toISOString();
  };

  const validateDates = () => {
    if (!startDate || !deadlineDate) return false;
    const start = new Date(combineDateTime(startDate, startTime));
    const deadline = new Date(combineDateTime(deadlineDate, deadlineTime));
    return deadline > start;
  };

  const handleCreateActivity = async () => {
    if (!title || !description || !startDate || !deadlineDate) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!validateDates()) {
      toast.error("Deadline must be after start time");
      return;
    }

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        toast.error("Session expired. Please log in again.");
        return;
      }

      setIsSubmitting(true);

      let imagePath = null;
      if (image) {
        const fileName = `${Date.now()}-${image.name}`.toLowerCase();
        const filePath = `image_activity/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("activity-images")
          .upload(filePath, image);
        if (uploadError) {
          toast.error(`Failed to upload image: ${uploadError.message}`);
          setIsSubmitting(false);
          return;
        }
        imagePath = filePath;
      }

      const { error: insertError } = await supabase.from("activities").insert([
        {
          class_id: classId,
          title,
          description,
          image_url: imagePath,
          start_time: combineDateTime(startDate, startTime),
          deadline: combineDateTime(deadlineDate, deadlineTime),
        },
      ]);

      if (insertError) {
        toast.error("Failed to create activity");
        setIsSubmitting(false);
        return;
      }

      setTitle("");
      setDescription("");
      setImage(null);
      setStartDate(new Date());
      setStartTime("10:00");
      setDeadlineDate(new Date(new Date().setDate(new Date().getDate() + 7)));
      setDeadlineTime("23:59");
      setIsSubmitting(false);
      onOpenChange(false);
      onActivityCreated();
      toast.success("Activity created successfully!");
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const DateTimePicker = ({
    label,
    date,
    setDate,
    time,
    setTime,
  }: DateTimePickerProps) => {
    const [openCalendar, setOpenCalendar] = useState(false);
    const [openTime, setOpenTime] = useState(false);

    const [tempTime, setTempTime] = useState<{ hours: string; minutes: string; period: "AM" | "PM" }>({
      hours: "10",
      minutes: "00",
      period: "AM",
    });

    React.useEffect(() => {
      const [hours, minutes] = time.split(":");
      const period = parseInt(hours) >= 12 ? "PM" : "AM";
      const adjustedHours = parseInt(hours) % 12 || 12;
      setTempTime({
        hours: adjustedHours.toString().padStart(2, "0"),
        minutes: minutes.padStart(2, "0"),
        period: period,
      });
    }, [time]);

    const handleHourChange = (value: string) =>
      setTempTime((prev) => ({ ...prev, hours: value }));
    const handleMinuteChange = (value: string) =>
      setTempTime((prev) => ({ ...prev, minutes: value }));
    const handlePeriodChange = (value: "AM" | "PM") =>
      setTempTime((prev) => ({ ...prev, period: value }));

    const saveTime = () => {
      const hours = parseInt(tempTime.hours);
      const totalHours =
        tempTime.period === "PM" && hours !== 12
          ? hours + 12
          : tempTime.period === "AM" && hours === 12
          ? 0
          : hours;
      setTime(`${totalHours.toString().padStart(2, "0")}:${tempTime.minutes}`);
    };

    return (
      <div className="flex items-center gap-4">
        <Label className="w-40 text-sm font-medium text-teal-300" htmlFor={`${label.toLowerCase()}-date`}>
          {label}
        </Label>

        <Popover open={openCalendar} onOpenChange={setOpenCalendar}>
          <PopoverTrigger asChild>
            <Button
              id={`${label.toLowerCase()}-date`}
              variant="outline"
              className="w-40 justify-between font-normal bg-gray-700/50 border-gray-600 text-gray-200 hover:border-teal-500 hover:ring-2 hover:ring-teal-500"
            >
              {date ? date.toLocaleDateString() : "Select date"}
              <ChevronDownIcon className="text-teal-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            className="bg-gray-800 border border-teal-500/20 rounded-2xl shadow-lg p-4 w-fit
                       fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate(d);
                setOpenCalendar(false);
              }}
              className="bg-gray-800 text-gray-200 [&_.rdp-day_selected]:bg-teal-500 [&_.rdp-day_selected]:text-white [&_.rdp-day_today]:text-teal-400 [&_.rdp-day_hover]:bg-teal-600/20"
            />
          </PopoverContent>
        </Popover>

        <Popover open={openTime} onOpenChange={setOpenTime}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-40 justify-between font-normal bg-gray-700/50 border-gray-600 text-gray-200 hover:border-teal-500 hover:ring-2 hover:ring-teal-500"
            >
              {`${tempTime.hours}:${tempTime.minutes} ${tempTime.period}`}
              <ChevronDownIcon className="text-teal-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-56 p-4 bg-gray-800 border border-teal-500/20 rounded-2xl shadow-lg flex flex-col gap-3
                       fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <div className="flex gap-2 justify-center">
              <select
                value={tempTime.hours}
                onChange={(e) => handleHourChange(e.target.value)}
                className="w-20 p-1 bg-gray-700/50 border border-gray-600 text-gray-200 rounded focus:ring-2 focus:ring-teal-500"
              >
                {Array.from({ length: 12 }, (_, i) =>
                  (i + 1).toString().padStart(2, "0")
                ).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-gray-200 self-center mx-1.5">:</span>
              <select
                value={tempTime.minutes}
                onChange={(e) => handleMinuteChange(e.target.value)}
                className="w-20 p-1 bg-gray-700/50 border border-gray-600 text-gray-200 rounded focus:ring-2 focus:ring-teal-500"
              >
                {Array.from({ length: 60 }, (_, i) =>
                  i.toString().padStart(2, "0")
                ).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => handlePeriodChange("AM")}
                className={`w-20 p-1 ${tempTime.period === "AM" ? "bg-teal-500/20" : "bg-gray-700/50"} border border-gray-600 text-gray-200`}
              >
                AM
              </Button>
              <Button
                variant="outline"
                onClick={() => handlePeriodChange("PM")}
                className={`w-20 p-1 ${tempTime.period === "PM" ? "bg-teal-500/20" : "bg-gray-700/50"} border border-gray-600 text-gray-200`}
              >
                PM
              </Button>
            </div>
            <Button
              onClick={() => {
                saveTime();
                setOpenTime(false);
              }}
              className="bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg"
            >
              Set Time
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-teal-500/20 rounded-3xl shadow-lg backdrop-blur-md p-4" style={{ maxWidth: "700px" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-teal-400">
            Create a New Activity
          </DialogTitle>
          <DialogDescription className="text-gray-200 mt-2">
            Provide details for the new activity.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-4">
            <Label className="w-40 text-sm font-medium text-teal-300" htmlFor="title">
              Title
            </Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              className="w-full md:w-96 border border-gray-600 rounded-lg p-2 bg-gray-700/50 text-gray-200 focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., Factorial Program Assignment"
            />
          </div>

          <div className="flex items-start gap-4">
            <Label className="w-40 text-sm font-medium text-teal-300 pt-2" htmlFor="description">
              Description
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
              className="w-full md:w-[385px] h-32 border border-gray-600 rounded-lg p-2 bg-gray-700/50 text-gray-200 focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="e.g., Write a program to calculate the factorial of a number."
            />
          </div>

          <DateTimePicker
            label="Start Time"
            date={startDate}
            setDate={setStartDate}
            time={startTime}
            setTime={setStartTime}
          />
          <DateTimePicker
            label="Deadline"
            date={deadlineDate}
            setDate={setDeadlineDate}
            time={deadlineTime}
            setTime={setDeadlineTime}
          />

          <div className="flex items-center gap-4">
            <Label className="w-40 text-sm font-medium text-teal-300" htmlFor="image">
              Image (Optional)
            </Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleImageChange(e)}
              className="w-55 h-10 border border-gray-600 rounded-lg p-1 bg-gray-700/50 text-gray-200 
                         file:h-8 file:px-4 file:bg-teal-500 file:text-white file:rounded-lg"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            onClick={handleCreateActivity}
            disabled={isSubmitting}
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg"
          >
            {isSubmitting ? "Submitting..." : "Create Activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
