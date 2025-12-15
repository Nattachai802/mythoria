import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { User } from 'lucide-react';

export const RelationshipNode = memo(({ data }: any) => {
    return (
        <div className="px-4 py-2 shadow-md rounded-md bg-card border-2 border-muted w-[200px] text-center hover:border-primary transition-colors">
            <Handle
                type="target"
                position={Position.Top}
                className="w-4 h-4 !bg-blue-500 hover:!bg-blue-400 !border-2 !border-white"
                style={{ cursor: 'crosshair' }}
            />

            <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-muted border-2 border-background shadow-sm">
                    {data.image ? (
                        <img src={data.image} alt={data.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <User className="w-6 h-6 text-muted-foreground" />
                        </div>
                    )}
                </div>
                <div>
                    <div className="text-sm font-bold truncate w-full px-2">{data.label}</div>
                    <div className="text-xs text-muted-foreground capitalize">{data.role}</div>
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Bottom}
                className="w-4 h-4 !bg-green-500 hover:!bg-green-400 !border-2 !border-white"
                style={{ cursor: 'crosshair' }}
            />
        </div>
    );
});

RelationshipNode.displayName = 'RelationshipNode';
