import React, { memo } from "react";
import BaseLessonsTab from "../LessonsTab";

function LessonsTab({ courseId, isInstructor }) {
  return <BaseLessonsTab courseId={courseId} isInstructor={isInstructor} />;
}

export default memo(LessonsTab);
