'use client';

import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

function SortableItem({ id, children }: { id: any, children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export function ScheduleKanban({ crews, assignments }: { crews: any[], assignments: any[] }) {
  const [crewAssignments, setCrewAssignments] = useState(assignments);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setCrewAssignments((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-3 gap-4">
        {crews.map(crew => (
          <div key={crew.id}>
            <h2>{crew.name}</h2>
            <SortableContext items={crewAssignments.filter(a => a.crewId === crew.id).map(a => a.id)}>
              {crewAssignments
                .filter(a => a.crewId === crew.id)
                .map(assignment => (
                  <SortableItem key={assignment.id} id={assignment.id}>
                    <div>{assignment.id}</div>
                  </SortableItem>
                ))}
            </SortableContext>
          </div>
        ))}
      </div>
    </DndContext>
  );
}
