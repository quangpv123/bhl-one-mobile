import { z } from "zod";

export const validationMessages = {
  required: "Vui lòng nhập thông tin bắt buộc.",
  phone: "Số điện thoại không hợp lệ.",
  email: "Email không hợp lệ.",
  date: "Ngày phải theo định dạng dd-mm-yyyy.",
  positiveNumber: "Giá trị phải lớn hơn 0.",
  nonNegativeNumber: "Giá trị không được nhỏ hơn 0.",
} as const;

export const requiredTextSchema = z.string().trim().min(1, validationMessages.required);
export const optionalTextSchema = z.string().trim();
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{8,20}$/, validationMessages.phone);
export const compactPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{9,15}$/, validationMessages.phone));
export const optionalEmailSchema = z
  .string()
  .trim()
  .refine(
    (value) => !value || z.string().email().safeParse(value).success,
    validationMessages.email,
  );
export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, validationMessages.date);
export const displayDateSchema = z
  .string()
  .trim()
  .regex(/^\d{2}-\d{2}-\d{4}$/, validationMessages.date);
export const displayDateTimeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}-\d{2}-\d{4} ([01]\d|2[0-3]):[0-5]\d$/, "Ngày giờ phải theo định dạng dd-mm-yyyy HH:mm.");
export const passwordSchema = z
  .string()
  .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
  .regex(/[a-z]/, "Mật khẩu phải có chữ thường.")
  .regex(/[A-Z]/, "Mật khẩu phải có chữ hoa.")
  .regex(/[0-9]/, "Mật khẩu phải có chữ số.");

export function decimalStringSchema({
  minimum = 0,
  maximum,
  integer = false,
  required = true,
  message,
}: {
  minimum?: number;
  maximum?: number;
  integer?: boolean;
  required?: boolean;
  message?: string;
} = {}) {
  return z.string().trim().superRefine((value, context) => {
    if (!value && !required) return;
    const parsed = Number(value.replace(",", "."));
    const invalid =
      !value ||
      !Number.isFinite(parsed) ||
      parsed < minimum ||
      (maximum !== undefined && parsed > maximum) ||
      (integer && !Number.isInteger(parsed));
    if (invalid) {
      context.addIssue({
        code: "custom",
        message:
          message ||
          (minimum > 0
            ? validationMessages.positiveNumber
            : validationMessages.nonNegativeNumber),
      });
    }
  });
}

export function firstZodError(result: z.ZodSafeParseResult<unknown>) {
  return result.success ? null : result.error.issues[0]?.message || validationMessages.required;
}

export function validateValue(
  value: unknown,
  options: {
    required?: boolean;
    phone?: boolean;
    schema?: z.ZodType;
  } = {},
) {
  if (options.schema) return firstZodError(options.schema.safeParse(value));

  const text = typeof value === "string" ? value : String(value ?? "");
  if (options.phone) {
    const schema = options.required ? phoneSchema : phoneSchema.or(z.literal(""));
    return firstZodError(schema.safeParse(text.trim()));
  }
  const schema = options.required ? requiredTextSchema : z.string();
  return firstZodError(schema.safeParse(text));
}

export function zodErrorMap(error: z.ZodError) {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

