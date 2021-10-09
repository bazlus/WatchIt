using Microsoft.AspNetCore.Identity;

namespace WatchIt.Domain.Models
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Text;
    using System.Threading.Tasks;
    using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

    public class ApplicationUser : IdentityUser
    {
        public IEnumerable<Like> Likes { get; set; }
    }
}
