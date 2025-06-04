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
    <Card className="mb-6 shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-t-xl">
        <CardTitle className="text-2xl md:text-3xl font-bold text-gray-900">Activities</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        {activities.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No activities created yet.</p>
        ) : (
          <ul className="space-y-6">
            {activities.map((activity) => (
              <li key={activity.id} className="border-b pb-4 last:border-b-0">
                <p className="text-base md:text-lg text-gray-800">{activity.description}</p>
                {activity.image_url && (
                  <div className="mt-4">
                    <Image
                      src={activity.image_url}
                      alt="Activity"
                      width={400}
                      height={300}
                      className="rounded-xl object-cover w-full max-w-[400px] h-auto shadow-md transition-opacity duration-300 hover:opacity-90"
                    />
                  </div>
                )}
                <p className="text-sm md:text-base text-gray-500 mt-2">
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