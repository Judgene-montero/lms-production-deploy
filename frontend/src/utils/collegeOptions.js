export const COLLEGE_OPTIONS = [
  { value: "CAS", label: "College of Arts & Sciences" },
  { value: "CCJE", label: "College of Criminal Justice Education" },
  { value: "CAF", label: "College of Agriculture & Forestry" },
  { value: "CTED", label: "College of Teacher Education" },
  { value: "CBA", label: "College of Business Administration" },
  { value: "CIT", label: "College of Industrial Technology" },
];

export const getCollegeLabel = (value) => {
  const match = COLLEGE_OPTIONS.find((option) => option.value === value);
  return match?.label || value || "";
};
