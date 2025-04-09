import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Image from "next/image";

interface Activity {
  id: string;
  description: string;
  image_url: string | null;
  created_at: string;
}

export default function ActivitiesList({ activities }: { activities: Activity[] }) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Activities</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-gray-500">No activities created yet.</p>
        ) : (
          <ul className="space-y-4">
            {activities.map((activity) => (
              <li key={activity.id} className="border-b pb-2">
                <p>{activity.description}</p>
                {activity.image_url && (
                  <div className="mt-2">
                    <Image
                      src={activity.image_url}
                      alt="Activity"
                      width={300}
                      height={200}
                      className="rounded-md"
                    />
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Created at: {new Date(activity.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}