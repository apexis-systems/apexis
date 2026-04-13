"use client";

import { useState, useEffect } from "react";
import { Project } from "@/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProject } from "@/services/projectService";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onUpdate: (updatedProject: Project) => void;
    initialFocus?: 'start_date' | 'end_date' | null;
}

export default function EditProjectModal({
    isOpen,
    onClose,
    project,
    onUpdate,
    initialFocus,
}: EditProjectModalProps) {
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description || "");
    const [startDate, setStartDate] = useState(
        project.start_date ? project.start_date.split("T")[0] : ""
    );
    const [endDate, setEndDate] = useState(
        project.end_date ? project.end_date.split("T")[0] : ""
    );
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setName(project.name);
        setDescription(project.description || "");
        setStartDate(project.start_date ? project.start_date.split("T")[0] : "");
        setEndDate(project.end_date ? project.end_date.split("T")[0] : "");
    }, [project]);

    useEffect(() => {
        if (isOpen && initialFocus) {
            setTimeout(() => {
                const element = document.getElementById(initialFocus);
                if (element) {
                    element.focus();
                    if ('showPicker' in HTMLInputElement.prototype) {
                        try { (element as HTMLInputElement).showPicker(); } catch(e){}
                    }
                }
            }, 100);
        }
    }, [isOpen, initialFocus]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await updateProject(project.id, {
                name,
                description,
                start_date: startDate,
                end_date: endDate,
            });

            onUpdate(response.project);
            toast.success("Project updated successfully");
            onClose();
        } catch (error) {
            console.error("Update error:", error);
            toast.error("Failed to update project");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Project</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Project Name (max 25)</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={25}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Company Name/Client Name (max 50)</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={50}
                            rows={3}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="start_date">Start Date</Label>
                            <Input
                                id="start_date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="end_date">End Date</Label>
                            <Input
                                id="end_date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
