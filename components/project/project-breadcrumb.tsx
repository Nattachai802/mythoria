import Link from "next/link";
import { Home } from "lucide-react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface BreadcrumbItemData {
    label: string;
    href?: string;
}

interface ProjectBreadcrumbProps {
    novelId: string;
    novelTitle: string;
    items?: BreadcrumbItemData[];
}

export function ProjectBreadcrumb({ novelId, novelTitle, items = [] }: ProjectBreadcrumbProps) {
    return (
        <Breadcrumb className="mb-4">
            <BreadcrumbList>
                {/* Dashboard */}
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link href="/dashboard" className="flex items-center gap-1">
                            <Home className="h-4 w-4" />
                            <span className="sr-only">Dashboard</span>
                        </Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />

                {/* Novel/Project */}
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link href={`/dashboard/project/${novelId}`}>
                            {novelTitle}
                        </Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>

                {/* Additional items */}
                {items.map((item, index) => (
                    <span key={item.label} className="contents">
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            {item.href ? (
                                <BreadcrumbLink asChild>
                                    <Link href={item.href}>{item.label}</Link>
                                </BreadcrumbLink>
                            ) : (
                                <BreadcrumbPage>{item.label}</BreadcrumbPage>
                            )}
                        </BreadcrumbItem>
                    </span>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
