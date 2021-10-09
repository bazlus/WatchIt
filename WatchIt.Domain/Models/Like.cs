using Microsoft.EntityFrameworkCore.Metadata.Internal;

namespace WatchIt.Domain.Models
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Text;
    using System.Threading.Tasks;

    public class Like
    {
        public int Id { get; set; }
        public Movie Movie { get; set; }
        public ApplicationUser User { get; set; }
    }
}
