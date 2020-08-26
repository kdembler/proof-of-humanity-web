import { SVG } from "@kleros/components";

export default function LinkedIn({ size = 16, ...rest }) {
  return (
    <SVG
      width={size}
      height={size}
      viewBox="0 0 18 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path
        d="M4.60023 16.6679H1.19326V5.6585H4.60023V16.6679ZM2.89491 4.15672C1.80571 4.15672 0.921875 3.25123 0.921875 2.15803C0.921875 1.06482 1.80571 0.177734 2.89491 0.177734C3.98411 0.177734 4.86795 1.06482 4.86795 2.15803C4.86795 3.25123 3.98411 4.15672 2.89491 4.15672ZM17.3516 16.6679H13.952V11.3086C13.952 10.0313 13.9263 8.39336 12.1806 8.39336C10.4093 8.39336 10.1379 9.78104 10.1379 11.2166V16.6679H6.73463V5.6585H10.0022V7.16028H10.0499C10.5047 6.29529 11.6159 5.38244 13.2735 5.38244C16.7208 5.38244 17.3553 7.66088 17.3553 10.6203V16.6679H17.3516Z"
        fill="white"
      />
    </SVG>
  );
}
